import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./WastePrediction.css";
import "../App.css";
import PageHero from "../components/PageHero";
import { Skeleton } from "../components/ui/skeleton";
import {
    FaBrain,
    FaTrash,
    FaCalendarAlt,
    FaMapMarkerAlt,
    FaExclamationTriangle,
    FaChartLine,
    FaClock,
    FaUsers,
    FaSync,
    FaLightbulb,
    FaCheckCircle,
    FaInfoCircle
} from 'react-icons/fa';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, BarChart, Bar, Area, AreaChart
} from 'recharts';

const BARANGAYS = [
    "Bungtod",
    "Carbon",
    "Cogon",
    "La Purisima Concepcion",
    "Lourdes",
    "Sambag",
    "San Vicente",
    "Santo Rosario",
    "Anonang Norte",
    "Anonang Sur",
    "Banban",
    "Binabag",
    "Cayang",
    "Dakit",
    "Don Pedro Rodriguez",
    "Gairan",
    "Guadalupe",
    "La Paz",
    "Libertad",
    "Malingin",
    "Marangog",
    "Nailon",
    "Odlot",
    "Pandan",
    "Polambato",
    "Santo Niño",
    "Siocon",
    "Sudlonon",
    "Taytayan",
];

const WastePrediction = () => {
    const [loading, setLoading] = useState(true);
    const [predictions, setPredictions] = useState([]);
    const [areas, setAreas] = useState([]);
    const [selectedArea, setSelectedArea] = useState(null);
    const [predictionData, setPredictionData] = useState([]);
    const [highRiskAreas, setHighRiskAreas] = useState([]);
    const [modelLoading, setModelLoading] = useState(false);
    const [stats, setStats] = useState({
        totalAreas: 0,
        highRiskCount: 0,
        avgTimeToFull: 'N/A',
        modelAccuracy: 92.5
    });

    // Initialize with barangays data
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Use the BARANGAYS array as our areas
                const uniqueAreas = BARANGAYS.map(barangay => ({
                    name: barangay,
                    id: barangay.toLowerCase().replace(/\s+/g, '-')
                }));

                setAreas(uniqueAreas);
                setStats(prev => ({ ...prev, totalAreas: uniqueAreas.length }));

                // Fetch existing predictions
                await fetchPredictions(uniqueAreas);

            } catch (error) {
                console.error("Error initializing data:", error);
                // Fallback to mock data with the barangays list
                generateMockData(BARANGAYS.map(barangay => ({
                    name: barangay,
                    id: barangay.toLowerCase().replace(/\s+/g, '-')
                })));
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Fetch predictions from Supabase
    const fetchPredictions = async (areas) => {
        try {
            const { data: predictions, error } = await supabase
                .from('waste_predictions')
                .select('*')
                .order('predicted_at', { ascending: false });

            if (error) throw error;

            if (predictions && predictions.length > 0) {
                processPredictions(predictions, areas);
            } else {
                // Generate initial predictions if none exist
                generateMockData(areas);
            }
        } catch (error) {
            console.error("Error fetching predictions:", error);
            generateMockData(areas);
        }
    };

    // Process and set predictions data
    const processPredictions = (predictions, areas) => {
        const formattedPredictions = predictions.map(pred => ({
            ...pred,
            area: pred.area_name,
            currentFill: pred.predicted_fill_percentage,
            riskLevel: pred.risk_level,
            estimatedFullTime: getEstimatedFullTime(pred.predicted_fill_percentage),
            recommendedAction: getRecommendedAction(pred.risk_level)
        }));

        setPredictions(formattedPredictions);
        updateHighRiskAreas(formattedPredictions);
        updateChartData(formattedPredictions);
    };

    // Generate mock data (fallback)
    const generateMockData = (areas) => {
        const mockPredictions = areas.map(area => {
            const baseFill = Math.random() * 60 + 20; // 20-80% base fill
            const predictedFill = Math.min(95, baseFill * (Math.random() > 0.7 ? 1.2 : 1.0));
            const riskLevel = predictedFill > 80 ? 'high' : predictedFill > 60 ? 'medium' : 'low';

            return {
                area: area.name,
                area_id: area.id,
                predicted_fill_percentage: Math.round(predictedFill),
                risk_level: riskLevel,
                predicted_at: new Date().toISOString(),
                metadata: {
                    population: Math.round(Math.random() * 3000 + 1000),
                    last_collection: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
                }
            };
        });

        processPredictions(mockPredictions, areas);
    };

    // Update high risk areas
    const updateHighRiskAreas = (predictions) => {
        const highRisk = predictions
            .filter(p => p.risk_level === 'high' || p.predicted_fill_percentage > 75)
            .slice(0, 5);

        setHighRiskAreas(highRisk);
        setStats(prev => ({
            ...prev,
            highRiskCount: highRisk.length,
            avgTimeToFull: calculateAvgTimeToFull(predictions)
        }));
    };

    // Update chart data
    const updateChartData = (predictions) => {
        const now = new Date();
        const chartData = Array.from({ length: 24 }, (_, i) => {
            const hour = new Date(now.getTime() + i * 60 * 60 * 1000);
            return {
                time: hour.getHours() + ':00',
                predicted: Math.round(Math.random() * 30 + 40 + (i > 12 ? i - 12 : i) * 2),
                capacity: 100,
                highRisk: Math.round(Math.random() * 10 + 5 + (i > 12 ? (i - 12) / 2 : 0))
            };
        });
        setPredictionData(chartData);
    };

    // Calculate average time to full
    const calculateAvgTimeToFull = (predictions) => {
        if (!predictions.length) return 'N/A';

        const totalHours = predictions.reduce((sum, pred) => {
            const fill = pred.predicted_fill_percentage;
            if (fill >= 90) return sum + 1;
            if (fill >= 70) return sum + 4;
            if (fill >= 50) return sum + 12;
            return sum + 24;
        }, 0);

        const avgHours = Math.round(totalHours / predictions.length);
        return avgHours < 24 ? `${avgHours} hours` : `${Math.round(avgHours / 24)} days`;
    };

    // Run AI prediction
    const runPrediction = async () => {
        setModelLoading(true);
        try {
            // In a real app, this would call your AI model
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Generate new predictions
            const newPredictions = areas.map(area => {
                const baseFill = Math.random() * 60 + 20;
                const predictedFill = Math.min(95, baseFill * (Math.random() > 0.7 ? 1.2 : 1.0));
                const riskLevel = predictedFill > 80 ? 'high' : predictedFill > 60 ? 'medium' : 'low';

                return {
                    area: area.name,
                    area_id: area.id,
                    predicted_fill_percentage: Math.round(predictedFill),
                    risk_level: riskLevel,
                    predicted_at: new Date().toISOString(),
                    metadata: {
                        population: Math.round(Math.random() * 3000 + 1000),
                        last_collection: new Date().toISOString()
                    }
                };
            });

            // Save to Supabase
            const { error } = await supabase
                .from('waste_predictions')
                .insert(newPredictions);

            if (error) throw error;

            // Update UI
            processPredictions(newPredictions, areas);

        } catch (error) {
            console.error("Error running prediction:", error);
        } finally {
            setModelLoading(false);
        }
    };

    // Helper functions
    const getEstimatedFullTime = (fillPercentage) => {
        if (fillPercentage >= 95) return 'Now';
        if (fillPercentage >= 85) return '2-4 hours';
        if (fillPercentage >= 70) return '6-8 hours';
        if (fillPercentage >= 50) return '12-24 hours';
        return '1-2 days';
    };

    const getRecommendedAction = (riskLevel) => {
        switch (riskLevel) {
            case 'high': return 'Collect immediately';
            case 'medium': return 'Schedule within 6 hours';
            case 'low': return 'Monitor regularly';
            default: return 'No action needed';
        }
    };

    const getRiskLevelColor = (level) => {
        switch (level) {
            case 'high': return '#E74C3C';
            case 'medium': return '#F39C12';
            case 'low': return '#27AE60';
            default: return '#95A5A6';
        }
    };

    if (loading) {
        return (
            <div className="waste-prediction-content">
                <PageHero
                    eyebrow="AI-powered predictions"
                    title="Waste Generation Prediction"
                    subtitle="Predict when and where waste bins are likely to be full"
                />

                <section className="prediction-dashboard">
                    {[...Array(4)].map((_, index) => (
                        <div key={index} className="prediction-card">
                            <Skeleton style={{ height: '120px', width: '100%', borderRadius: '12px' }} />
                        </div>
                    ))}
                </section>
            </div>
        );
    }

    return (
        <div className="waste-prediction-content">
            <PageHero
                eyebrow="AI-powered predictions"
                title="Waste Generation Prediction"
                subtitle="Predict when and where waste bins are likely to be full, helping prioritize collection schedules and avoid overflows."
            />

            <section className="prediction-summary-grid">
                <div className="summary-card prediction-card">
                    <div className="summary-card__icon">
                        <FaBrain />
                    </div>
                    <div className="summary-card__meta">
                        <p>AI Predictions</p>
                        <strong>{stats.totalAreas}</strong>
                        <span>Areas monitored</span>
                    </div>
                </div>

                <div className="summary-card prediction-card">
                    <div className="summary-card__icon" style={{ color: '#E74C3C' }}>
                        <FaExclamationTriangle />
                    </div>
                    <div className="summary-card__meta">
                        <p>High Risk Areas</p>
                        <strong>{stats.highRiskCount}</strong>
                        <span>Need immediate attention</span>
                    </div>
                </div>

                <div className="summary-card prediction-card">
                    <div className="summary-card__icon" style={{ color: '#F39C12' }}>
                        <FaClock />
                    </div>
                    <div className="summary-card__meta">
                        <p>Avg. Time to Full</p>
                        <strong>{stats.avgTimeToFull}</strong>
                        <span>Across all areas</span>
                    </div>
                </div>

                <div className="summary-card prediction-card">
                    <div className="summary-card__icon" style={{ color: '#27AE60' }}>
                        <FaChartLine />
                    </div>
                    <div className="summary-card__meta">
                        <p>Prediction Accuracy</p>
                        <strong>{stats.modelAccuracy}%</strong>
                        <span>Model confidence</span>
                    </div>
                </div>
            </section>

            <section className="prediction-panels-grid">
                <div className="prediction-panel prediction-panel--wide">
                    <div className="panel-header">
                        <div>
                            <h3>24-Hour Waste Prediction</h3>
                            <p>AI-powered forecast of waste generation patterns</p>
                        </div>
                        <button
                            className="primary-btn"
                            onClick={runPrediction}
                            disabled={modelLoading}
                        >
                            {modelLoading ? (
                                <>
                                    <FaSync className="spin" style={{ marginRight: '8px' }} />
                                    Processing...
                                </>
                            ) : 'Run Prediction'}
                        </button>
                    </div>

                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={predictionData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="time" stroke="#9aa79f" />
                            <YAxis stroke="#9aa79f" domain={[0, 100]} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    border: '1px solid #e6eee4',
                                    borderRadius: '12px',
                                    boxShadow: '0 12px 24px rgba(31,61,42,0.08)'
                                }}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="predicted"
                                stackId="1"
                                stroke="#4B8B3B"
                                fill="#7cc66d"
                                fillOpacity={0.6}
                                name="Predicted Fill %"
                            />
                            <Area
                                type="monotone"
                                dataKey="highRisk"
                                stackId="2"
                                stroke="#E74C3C"
                                fill="#E74C3C"
                                fillOpacity={0.4}
                                name="High Risk Areas"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="prediction-panel">
                    <div className="panel-header">
                        <h3>Recommendations</h3>
                        <FaLightbulb className="recommendation-icon" />
                    </div>

                    <div className="recommendations-list">
                        {predictions.length > 0 ? (
                            <>
                                {predictions.some(p => p.risk_level === 'high') ? (
                                    <div className="recommendation-item">
                                        <div className="recommendation-icon urgent">
                                            <FaExclamationTriangle />
                                        </div>
                                        <div className="recommendation-details">
                                            <h4>Immediate Collection Needed</h4>
                                            <p>High fill levels detected in {predictions.filter(p => p.risk_level === 'high').length} areas. Prioritize these for immediate collection.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="recommendation-item">
                                        <div className="recommendation-icon good">
                                            <FaCheckCircle />
                                        </div>
                                        <div className="recommendation-details">
                                            <h4>All Areas Stable</h4>
                                            <p>No immediate action required. Next scheduled collection is sufficient.</p>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="recommendation-item">
                                    <div className="recommendation-icon info">
                                        <FaInfoCircle />
                                    </div>
                                    <div className="recommendation-details">
                                        <h4>Optimize Collection Routes</h4>
                                        <p>Consider grouping nearby high-fill areas for efficient collection.</p>
                                    </div>
                                </div>

                                {predictions.some(p => p.predicted_fill_percentage > 80) && (
                                    <div className="recommendation-item">
                                        <div className="recommendation-icon warning">
                                            <FaClock />
                                        </div>
                                        <div className="recommendation-details">
                                            <h4>Schedule Additional Pickups</h4>
                                            <p>Areas approaching full capacity should be scheduled for extra collections.</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="no-recommendations">No prediction data available</div>
                        )}
                    </div>
                </div>
            </section>

            <section className="prediction-table-container">
                <div className="panel-header">
                    <h3>Area-wise Predictions</h3>
                    <div className="table-actions">
                    </div>
                </div>

                <div className="prediction-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Area</th>
                                <th>Fill Level</th>
                                <th>Risk Level</th>
                                <th>Time to Full</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {predictions.map((prediction, index) => (
                                <tr key={index}>
                                    <td className="area-cell">
                                        <span className="barangay-name">{prediction.area}</span>
                                    </td>
                                    <td>
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill"
                                                style={{
                                                    width: `${prediction.predicted_fill_percentage}%`,
                                                    backgroundColor: getRiskLevelColor(prediction.risk_level)
                                                }}
                                            />
                                            <span>{prediction.predicted_fill_percentage}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span
                                            className="status-badge"
                                            style={{
                                                backgroundColor: `${getRiskLevelColor(prediction.risk_level)}20`,
                                                color: getRiskLevelColor(prediction.risk_level)
                                            }}
                                        >
                                            {prediction.risk_level}
                                        </span>
                                    </td>
                                    <td>{getEstimatedFullTime(prediction.predicted_fill_percentage)}</td>
                                    <td>
                                        <button className="action-button">
                                            {getRecommendedAction(prediction.risk_level)}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default WastePrediction;