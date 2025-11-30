/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import * as tf from '@tensorflow/tfjs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { 
  Brain, 
  RefreshCw, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  MapPin,
  BarChart3,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  AlertCircle as InfoIcon
} from 'lucide-react';
import PageHero from '../components/PageHero';
import './RoutePerformanceAI.css';

// Helper functions
function extractMinutesFromInterval(intervalStr) {
  if (!intervalStr) return 0;
  // Handle PostgreSQL interval format
  if (typeof intervalStr === 'string') {
    const match = intervalStr.match(/(\d+):(\d+):(\d+)/);
    if (match) {
      const hours = parseInt(match[1]) || 0;
      const minutes = parseInt(match[2]) || 0;
      const seconds = parseInt(match[3]) || 0;
      return hours * 60 + minutes + seconds / 60;
    }
  }
  return 0;
}


// Normalize function for TensorFlow
function normalize(value, min, max) {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

// Denormalize function
function denormalize(value, min, max) {
  return value * (max - min) + min;
}

// Prepare training data for TensorFlow
function prepareTrainingData(data) {
  if (!data || data.length < 10) return null;

  const trainingData = data
    .filter(r => 
      r.performance_score !== null && 
      r.total_areas_covered !== null &&
      r.avg_collection_time
    )
    .map(record => {
      const routeNum = parseFloat(record.route_number) || 0;
      const areas = record.total_areas_covered || 0;
      const complaints = record.complaints || 0;
      const delayed = record.delayed ? 1 : 0;
      const timeMinutes = extractMinutesFromInterval(record.avg_collection_time);
      const score = parseFloat(record.performance_score) || 0;

      return {
        features: [routeNum, areas, complaints, delayed, timeMinutes],
        target: score
      };
    });

  if (trainingData.length < 10) return null;

  // Find min/max for normalization
  const routeNums = trainingData.map(d => d.features[0]);
  const areas = trainingData.map(d => d.features[1]);
  const complaints = trainingData.map(d => d.features[2]);
  const timeMinutes = trainingData.map(d => d.features[4]);
  const scores = trainingData.map(d => d.target);

  const minMax = {
    routeNum: { min: Math.min(...routeNums), max: Math.max(...routeNums) },
    areas: { min: Math.min(...areas), max: Math.max(...areas) },
    complaints: { min: Math.min(...complaints), max: Math.max(...complaints) },
    timeMinutes: { min: Math.min(...timeMinutes), max: Math.max(...timeMinutes) },
    score: { min: Math.min(...scores), max: Math.max(...scores) }
  };

  // Normalize features and targets
  const normalizedData = trainingData.map(d => ({
    features: [
      normalize(d.features[0], minMax.routeNum.min, minMax.routeNum.max),
      normalize(d.features[1], minMax.areas.min, minMax.areas.max),
      normalize(d.features[2], minMax.complaints.min, minMax.complaints.max),
      d.features[3], // delayed is already 0 or 1
      normalize(d.features[4], minMax.timeMinutes.min, minMax.timeMinutes.max)
    ],
    target: normalize(d.target, minMax.score.min, minMax.score.max)
  }));

  return {
    data: normalizedData,
    minMax
  };
}

// Create and train TensorFlow model
async function createAndTrainModel(trainingData) {
  if (!trainingData || trainingData.data.length < 10) {
    throw new Error('Not enough data to train model (need at least 10 records)');
  }

  // Prepare tensors
  const xs = tf.tensor2d(trainingData.data.map(d => d.features));
  const ys = tf.tensor2d(trainingData.data.map(d => [d.target]));

  // Create model
  const model = tf.sequential();
  model.add(tf.layers.dense({
    inputShape: [5], // routeNum, areas, complaints, delayed, timeMinutes
    units: 32,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu'
  }));
  model.add(tf.layers.dense({
    units: 1, // Output: performance score
    activation: 'sigmoid' // Keep output between 0-1 (will denormalize)
  }));

  // Compile model
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError'
    // Removed metrics as it may not be supported in this TensorFlow.js version
  });

  // Train model
  const history = await model.fit(xs, ys, {
    epochs: 50,
    batchSize: Math.min(32, Math.floor(trainingData.data.length / 2)),
    shuffle: true,
    validationSplit: 0.2,
    verbose: 0 // Set to 1 to see training progress
  });

  // Clean up tensors
  xs.dispose();
  ys.dispose();

  return { model, history, minMax: trainingData.minMax };
}

// Predict using TensorFlow model
async function predictWithModel(model, minMax, routeNum, areas, complaints, delayed, timeMinutes) {
  // Normalize input features
  const normalizedFeatures = [
    normalize(routeNum, minMax.routeNum.min, minMax.routeNum.max),
    normalize(areas, minMax.areas.min, minMax.areas.max),
    normalize(complaints, minMax.complaints.min, minMax.complaints.max),
    delayed ? 1 : 0,
    normalize(timeMinutes, minMax.timeMinutes.min, minMax.timeMinutes.max)
  ];

  // Predict
  const input = tf.tensor2d([normalizedFeatures]);
  const prediction = model.predict(input);
  const predictedValue = await prediction.data();
  
  // Clean up
  input.dispose();
  prediction.dispose();

  // Denormalize and clamp
  const denormalized = denormalize(predictedValue[0], minMax.score.min, minMax.score.max);
  return Math.max(0, Math.min(100, denormalized));
}

// Fallback simple prediction
function predictScoreSimple(currentScore, areas, complaints, delayRate) {
  let predicted = parseFloat(currentScore);
  predicted -= complaints * 2;
  predicted -= delayRate * 15;
  if (areas > 5) {
    predicted += 2;
  }
  return Math.max(0, Math.min(100, predicted)).toFixed(2);
}

function calculateStatistics(data) {
  const validScores = data.filter(r => r.performance_score !== null);
  if (validScores.length === 0) return null;

  const scores = validScores.map(r => parseFloat(r.performance_score));
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const totalComplaints = data.reduce((sum, r) => sum + (r.complaints || 0), 0);
  const totalDelays = data.filter(r => r.delayed).length;
  const delayRate = (totalDelays / data.length) * 100;

  return {
    total_records: data.length,
    avg_score: avgScore.toFixed(2),
    min_score: minScore.toFixed(2),
    max_score: maxScore.toFixed(2),
    total_complaints: totalComplaints,
    delay_rate: delayRate.toFixed(1) + '%',
    unique_routes: new Set(data.map(r => r.route_number)).size
  };
}

function getScoreLevel(score) {
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

// Generate AI-powered recommendations for routes
function generateRecommendations(predictions, performanceData) {
  const recommendations = [];

  if (!predictions || predictions.length === 0) {
    return recommendations;
  }

  // Analyze each route
  predictions.forEach(pred => {
    const routeNum = pred.route;
    const currentScore = parseFloat(pred.current_score);
    const predictedScore = parseFloat(pred.predicted_score);
    const scoreDiff = predictedScore - currentScore;
    const routeData = performanceData.filter(r => r.route_number === routeNum);

    // Recommendation 1: Declining Performance
    if (scoreDiff < -5 && currentScore < 50) {
      recommendations.push({
        type: 'critical',
        priority: 'high',
        route: routeNum,
        title: `Route ${routeNum} Performance Declining`,
        message: `Predicted to drop from ${currentScore} to ${predictedScore}. Immediate attention needed.`,
        suggestions: [
          pred.total_complaints > 10 ? `Address ${pred.total_complaints} complaints - investigate root causes` : null,
          parseFloat(pred.delay_rate) > 20 ? `Reduce delays (current rate: ${pred.delay_rate}) - review schedule or resources` : null,
          pred.avg_areas < 5 ? `Consider optimizing route to cover more areas efficiently` : null
        ].filter(Boolean),
        icon: AlertTriangle,
        action: 'Review route schedule and resource allocation'
      });
    }

    // Recommendation 2: High Complaint Rate
    if (pred.total_complaints > 15) {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        route: routeNum,
        title: `Route ${routeNum} Has High Complaint Rate`,
        message: `${pred.total_complaints} complaints reported. This is significantly above average.`,
        suggestions: [
          'Review complaint details to identify common issues',
          'Consider reassigning crew or adjusting collection times',
          'Check if route areas need better coverage',
          'Investigate if equipment or vehicle issues are causing problems'
        ],
        icon: AlertCircle,
        action: 'Review complaints and take corrective action'
      });
    }

    // Recommendation 3: Frequent Delays
    if (parseFloat(pred.delay_rate) > 25) {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        route: routeNum,
        title: `Route ${routeNum} Experiences Frequent Delays`,
        message: `Delay rate of ${pred.delay_rate} is above acceptable threshold.`,
        suggestions: [
          'Review route schedule - may need earlier start time',
          'Check traffic patterns and consider alternative routes',
          'Evaluate if route is too long or covers too many areas',
          'Consider adding resources or splitting the route'
        ],
        icon: Clock,
        action: 'Optimize route schedule and timing'
      });
    }

    // Recommendation 4: Low Area Coverage
    if (parseFloat(pred.avg_areas) < 4) {
      recommendations.push({
        type: 'info',
        priority: 'medium',
        route: routeNum,
        title: `Route ${routeNum} Has Low Area Coverage`,
        message: `Averages only ${pred.avg_areas} areas per collection. Could be more efficient.`,
        suggestions: [
          'Review route optimization - may be able to cover more areas',
          'Check if collection times can be reduced to allow more coverage',
          'Consider if route boundaries need adjustment',
          'Evaluate if additional resources would help'
        ],
        icon: MapPin,
        action: 'Review route efficiency and coverage'
      });
    }

    // Recommendation 5: Improving Performance (Positive)
    if (scoreDiff > 5 && currentScore > 50) {
      recommendations.push({
        type: 'success',
        priority: 'low',
        route: routeNum,
        title: `Route ${routeNum} Showing Improvement`,
        message: `Performance improving! Predicted to reach ${predictedScore} (up from ${currentScore}).`,
        suggestions: [
          'Continue current practices - they are working well',
          'Consider applying successful strategies to other routes',
          'Monitor to ensure improvement continues'
        ],
        icon: TrendingUp,
        action: 'Maintain current practices'
      });
    }

    // Recommendation 6: Excellent Performance
    if (currentScore >= 75 && predictedScore >= 75) {
      recommendations.push({
        type: 'success',
        priority: 'low',
        route: routeNum,
        title: `Route ${routeNum} Performing Excellently`,
        message: `Consistently high performance (${currentScore}). Great work!`,
        suggestions: [
          'Use as a model for other routes',
          'Consider if this route can handle additional areas',
          'Recognize crew for excellent performance'
        ],
        icon: CheckCircle,
        action: 'Use as best practice example'
      });
    }

    // Recommendation 7: High Collection Time
    const avgTimeHours = parseFloat(pred.avg_time_minutes) / 60;
    if (avgTimeHours > 7) {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        route: routeNum,
        title: `Route ${routeNum} Takes Too Long`,
        message: `Average collection time is ${avgTimeHours.toFixed(1)} hours. This is inefficient.`,
        suggestions: [
          'Review route path - may need optimization',
          'Check if crew size is adequate',
          'Investigate if equipment issues are slowing collection',
          'Consider splitting route or adjusting boundaries'
        ],
        icon: Clock,
        action: 'Optimize route path and resources'
      });
    }
  });

  // Sort by priority (high to low)
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

  return recommendations;
}

export default function RoutePerformanceAI() {
  const [performanceData, setPerformanceData] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [trainingModel, setTrainingModel] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const modelRef = useRef(null);
  const minMaxRef = useRef(null);

  // Generate predictions using TensorFlow model
  const generatePredictionsML = useCallback(async (data, model, minMax) => {
    // Group by route
    const routeGroups = {};
    data.forEach(record => {
      const route = record.route_number || 'Unknown';
      if (!routeGroups[route]) {
        routeGroups[route] = [];
      }
      routeGroups[route].push(record);
    });

    // Generate predictions for each route using ML model
    const predictions = await Promise.all(
      Object.entries(routeGroups).map(async ([route, records]) => {
        const avgScore = records.reduce((sum, r) => sum + (r.performance_score || 0), 0) / records.length;
        const avgAreas = records.reduce((sum, r) => sum + (r.total_areas_covered || 0), 0) / records.length;
        const totalComplaints = records.reduce((sum, r) => sum + (r.complaints || 0), 0);
        const delayRate = records.filter(r => r.delayed).length / records.length;
        const avgDelayed = delayRate > 0.5 ? 1 : 0;

        // Extract average time in minutes
        const avgTimeMinutes = records
          .filter(r => r.avg_collection_time)
          .map(r => extractMinutesFromInterval(r.avg_collection_time))
          .reduce((sum, t, i, arr) => sum + t / arr.length, 0);

        // Use ML model to predict
        const routeNum = parseFloat(route) || 0;
        const predictedScore = await predictWithModel(
          model,
          minMax,
          routeNum,
          avgAreas,
          totalComplaints,
          avgDelayed,
          avgTimeMinutes
        );

        return {
          route,
          current_score: avgScore.toFixed(2),
          predicted_score: predictedScore.toFixed(2),
          avg_areas: avgAreas.toFixed(1),
          total_complaints: totalComplaints,
          delay_rate: (delayRate * 100).toFixed(1) + '%',
          avg_time_minutes: avgTimeMinutes.toFixed(0),
          data_points: records.length,
          ml_prediction: true
        };
      })
    );

    return predictions.sort((a, b) => parseFloat(b.predicted_score) - parseFloat(a.predicted_score));
  }, []);

  // Fallback simple predictions
  const generatePredictionsSimple = useCallback((data) => {
    // Group by route
    const routeGroups = {};
    data.forEach(record => {
      const route = record.route_number || 'Unknown';
      if (!routeGroups[route]) {
        routeGroups[route] = [];
      }
      routeGroups[route].push(record);
    });

    // Generate predictions for each route
    return Object.entries(routeGroups).map(([route, records]) => {
      const avgScore = records.reduce((sum, r) => sum + (r.performance_score || 0), 0) / records.length;
      const avgAreas = records.reduce((sum, r) => sum + (r.total_areas_covered || 0), 0) / records.length;
      const totalComplaints = records.reduce((sum, r) => sum + (r.complaints || 0), 0);
      const delayRate = records.filter(r => r.delayed).length / records.length;

      // Extract average time in minutes
      const avgTimeMinutes = records
        .filter(r => r.avg_collection_time)
        .map(r => extractMinutesFromInterval(r.avg_collection_time))
        .reduce((sum, t, i, arr) => sum + t / arr.length, 0);

      return {
        route,
        current_score: avgScore.toFixed(2),
        predicted_score: predictScoreSimple(avgScore, avgAreas, totalComplaints, delayRate),
        avg_areas: avgAreas.toFixed(1),
        total_complaints: totalComplaints,
        delay_rate: (delayRate * 100).toFixed(1) + '%',
        avg_time_minutes: avgTimeMinutes.toFixed(0),
        data_points: records.length,
        ml_prediction: false
      };
    }).sort((a, b) => parseFloat(b.predicted_score) - parseFloat(a.predicted_score));
  }, []);

  // Train model and generate predictions
  const trainModelAndPredict = useCallback(async (data) => {
    try {
      setTrainingModel(true);

      // Prepare training data
      const trainingData = prepareTrainingData(data);
      
      if (!trainingData) {
        console.warn('Not enough data for ML model, using simple predictions');
        const predictions = generatePredictionsSimple(data);
        setPredictions(predictions);
        setModelReady(false);
        setTrainingModel(false);
        
        // Generate recommendations
        const recs = generateRecommendations(predictions, data);
        setRecommendations(recs);
        return;
      }

      // Create and train model
      console.log('🧠 Training TensorFlow.js model...');
      const { model, minMax } = await createAndTrainModel(trainingData);
      
      // Store model and minMax for predictions
      modelRef.current = model;
      minMaxRef.current = minMax;
      setModelReady(true);
      console.log('✅ Model trained successfully!');

      // Generate predictions using the trained model
      const predictions = await generatePredictionsML(data, model, minMax);
      setPredictions(predictions);

      // Generate AI recommendations
      const recs = generateRecommendations(predictions, data);
      setRecommendations(recs);

    } catch (err) {
      console.error('Error training model:', err);
      // Fallback to simple predictions
      const predictions = generatePredictionsSimple(data);
      setPredictions(predictions);
      setModelReady(false);

      // Generate recommendations even with simple predictions
      const recs = generateRecommendations(predictions, data);
      setRecommendations(recs);
    } finally {
      setTrainingModel(false);
    }
  }, [generatePredictionsML, generatePredictionsSimple]);

  const fetchPerformanceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch route performance summary
      const { data, error: fetchError } = await supabase.rpc(
        'get_route_performance_summary',
        {
          p_route_id: null, // All routes
          p_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0],
          p_end_date: new Date().toISOString().split('T')[0]
        }
      );

      if (fetchError) {
        console.error('Error fetching performance data:', fetchError);
        setError('Failed to load route performance data');
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setError('No route performance data available. Make sure you have collections with route_id set.');
        setLoading(false);
        return;
      }

      console.log('Fetched performance data:', data);

      // Process data
      setPerformanceData(data);

      // Calculate statistics
      const stats = calculateStatistics(data);
      setStats(stats);

      // Train TensorFlow model and generate predictions
      trainModelAndPredict(data);

    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [trainModelAndPredict]);

  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  // Cleanup model on unmount
  useEffect(() => {
    return () => {
      if (modelRef.current) {
        modelRef.current.dispose();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="route-ai-container">
        <PageHero
          title="Route Performance AI"
          subtitle="Analyzing route performance data..."
        />
        <div className="route-ai-loading">
          <Loader2 className="route-ai-spinner" size={48} />
          <p>Loading route performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="route-ai-container">
        <PageHero
          eyebrow="AI Analysis"
          title="Performance Predictions"
          subtitle="AI-powered route optimization and predictions"
        />
        <div className="route-ai-error">
          <AlertCircle className="route-ai-error-icon" size={48} />
          <h3>Error Loading Data</h3>
          <p>{error}</p>
          <button className="route-ai-button route-ai-button-primary" onClick={fetchPerformanceData}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="route-ai-container">
      <PageHero
        eyebrow="AI Analysis"
        title="Performance Predictions"
        subtitle={modelReady ? "AI-powered route optimization and performance predictions" : trainingModel ? "Training AI model..." : "AI-powered route optimization and performance predictions"}
        action={
          <button 
            className="route-ai-button route-ai-button-primary route-ai-button-icon"
            onClick={fetchPerformanceData}
            disabled={loading || trainingModel}
          >
            <RefreshCw size={16} className={loading || trainingModel ? 'route-ai-spin' : ''} />
            Refresh
          </button>
        }
      />

      {/* Training Indicator */}
      {trainingModel && (
        <div className="route-ai-training-banner">
          <Loader2 className="route-ai-spinner" size={16} />
          <span>Training TensorFlow.js model with {performanceData.length} records...</span>
        </div>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="route-ai-stats-grid">
          <div className="route-ai-stat-card">
            <div className="route-ai-stat-icon route-ai-stat-icon-primary">
              <BarChart3 size={20} />
            </div>
            <div className="route-ai-stat-content">
              <p className="route-ai-stat-label">Total Records</p>
              <h3 className="route-ai-stat-value">{stats.total_records}</h3>
            </div>
          </div>
          <div className="route-ai-stat-card">
            <div className="route-ai-stat-icon route-ai-stat-icon-success">
              <TrendingUp size={20} />
            </div>
            <div className="route-ai-stat-content">
              <p className="route-ai-stat-label">Average Score</p>
              <h3 className="route-ai-stat-value">{stats.avg_score}</h3>
            </div>
          </div>
          <div className="route-ai-stat-card">
            <div className="route-ai-stat-icon route-ai-stat-icon-info">
              <MapPin size={20} />
            </div>
            <div className="route-ai-stat-content">
              <p className="route-ai-stat-label">Active Routes</p>
              <h3 className="route-ai-stat-value">{stats.unique_routes}</h3>
            </div>
          </div>
          <div className="route-ai-stat-card">
            <div className="route-ai-stat-icon route-ai-stat-icon-warning">
              <Clock size={20} />
            </div>
            <div className="route-ai-stat-content">
              <p className="route-ai-stat-label">Delay Rate</p>
              <h3 className="route-ai-stat-value route-ai-stat-value-warning">{stats.delay_rate}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Predictions Chart */}
      {predictions.length > 0 && (
        <div className="route-ai-card">
          <div className="route-ai-card-header">
            <h2 className="route-ai-card-title">Performance Predictions</h2>
            <p className="route-ai-card-description">Current vs predicted performance scores</p>
          </div>
          <div className="route-ai-chart-container">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={predictions} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="route"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke="#6b7280"
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                  label={{ value: 'Route', position: 'insideBottom', offset: -5, fill: '#6b7280' }}
                />
                <YAxis
                  label={{ value: 'Performance Score', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
                  stroke="#6b7280"
                  domain={[0, 100]}
                  tick={{ fill: '#6b7280' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value, name) => {
                    if (name === 'current_score') return [`${value}`, 'Current Score'];
                    if (name === 'predicted_score') return [`${value}`, 'Predicted Score'];
                    return [value, name];
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Bar dataKey="current_score" fill="#52A65E" name="Current Score" radius={[6, 6, 0, 0]} />
                <Bar dataKey="predicted_score" fill="#336A29" name="Predicted Score" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Predictions Table */}
      {predictions.length > 0 && (
        <div className="route-ai-card">
          <div className="route-ai-card-header">
            <h2 className="route-ai-card-title">Detailed Route Analysis</h2>
            <p className="route-ai-card-description">Comprehensive performance metrics for each route</p>
          </div>
          <div className="route-ai-table-wrapper">
            <table className="route-ai-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Current Score</th>
                  <th>Predicted Score</th>
                  <th>Avg Areas</th>
                  <th>Complaints</th>
                  <th>Delay Rate</th>
                  <th>Data Points</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((pred, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="route-ai-route-badge">
                        Route {pred.route}
                      </div>
                    </td>
                    <td>
                      <span className={`route-ai-score-badge route-ai-score-${getScoreLevel(parseFloat(pred.current_score))}`}>
                        {pred.current_score}
                      </span>
                    </td>
                    <td>
                      <div className="route-ai-score-badge-container">
                        <span className="route-ai-score-badge route-ai-score-predicted">
                          {pred.predicted_score}
                        </span>
                        {pred.ml_prediction && (
                          <span className="route-ai-ml-indicator" title="ML-Powered Prediction">
                            <Sparkles size={12} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{pred.avg_areas}</td>
                    <td>
                      {pred.total_complaints > 0 ? (
                        <span className="route-ai-badge route-ai-badge-warning">
                          {pred.total_complaints}
                        </span>
                      ) : (
                        <span className="route-ai-badge route-ai-badge-success">0</span>
                      )}
                    </td>
                    <td>{pred.delay_rate}</td>
                    <td>
                      <span className="route-ai-badge route-ai-badge-info">
                        {pred.data_points}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="route-ai-card">
          <div className="route-ai-card-header">
            <div className="route-ai-recommendations-header">
              <Lightbulb className="route-ai-title-icon" size={20} />
              <div>
                <h2 className="route-ai-card-title">AI Recommendations</h2>
                <p className="route-ai-card-description">
                  Actionable insights based on performance analysis
                </p>
              </div>
            </div>
            <span className="route-ai-recommendation-count">
              {recommendations.length} {recommendations.length === 1 ? 'recommendation' : 'recommendations'}
            </span>
          </div>
          <div className="route-ai-recommendations-grid">
            {recommendations.map((rec, idx) => {
              const Icon = rec.icon;
              return (
                <div 
                  key={idx} 
                  className={`route-ai-recommendation route-ai-recommendation-${rec.type}`}
                >
                  <div className="route-ai-recommendation-header">
                    <div className="route-ai-recommendation-icon-wrapper">
                      <Icon size={20} />
                    </div>
                    <div className="route-ai-recommendation-title-group">
                      <h3 className="route-ai-recommendation-title">{rec.title}</h3>
                      <span className={`route-ai-priority-badge route-ai-priority-${rec.priority}`}>
                        {rec.priority} priority
                      </span>
                    </div>
                  </div>
                  <p className="route-ai-recommendation-message">{rec.message}</p>
                  
                  {rec.suggestions && rec.suggestions.length > 0 && (
                    <div className="route-ai-recommendation-suggestions">
                      <p className="route-ai-suggestions-title">Suggested Actions:</p>
                      <ul className="route-ai-suggestions-list">
                        {rec.suggestions.map((suggestion, sIdx) => (
                          <li key={sIdx}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="route-ai-recommendation-action">
                    <span className="route-ai-action-label">💡 Action:</span>
                    <span className="route-ai-action-text">{rec.action}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recommendations.length === 0 && predictions.length > 0 && (
        <div className="route-ai-card">
          <div className="route-ai-empty-state">
            <CheckCircle size={48} className="route-ai-empty-state-icon" />
            <h3 className="route-ai-empty-state-title">All Routes Performing Well</h3>
            <p className="route-ai-empty-state-text">
              No critical issues detected. All routes are meeting performance standards.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

