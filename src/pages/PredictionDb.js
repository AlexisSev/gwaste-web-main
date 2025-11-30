/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function PredictionDb() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDataAndPredict() {
      try {
        setLoading(true);
        setError(null);

        // Fetch collections data
        const { data, error } = await supabase
          .from('collections')
          .select('route_id, waste_type, created_at, collected_at')
          .not('collected_at', 'is', null)
          .order('collected_at', { ascending: false })
          .limit(100); // Limit for better performance

        if (error) {
          console.error('Error fetching collections:', error);
          setError('Failed to load collection data');
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          setError('No collection data available for predictions');
          setLoading(false);
          return;
        }

        console.log('Fetched collections data:', data.length, 'records');

        // Convert to durations in hours
        const formattedData = data.map(row => ({
          route_id: row.route_id || 'Unknown',
          waste_type: row.waste_type || 'Unknown',
          collection_duration: Math.max(
            (new Date(row.collected_at) - new Date(row.created_at)) / (1000 * 3600),
            0.1 // Minimum 6 minutes
          ),
        })).filter(item => item.collection_duration > 0 && item.collection_duration < 24); // Filter reasonable durations

        console.log('Processed data:', formattedData.length, 'valid records');

        // Group by route and calculate averages
        const routeStats = {};
        formattedData.forEach(item => {
          if (!routeStats[item.route_id]) {
            routeStats[item.route_id] = {
              totalDuration: 0,
              count: 0,
              wasteTypes: {}
            };
          }
          routeStats[item.route_id].totalDuration += item.collection_duration;
          routeStats[item.route_id].count += 1;

          // Track waste types
          routeStats[item.route_id].wasteTypes[item.waste_type] =
            (routeStats[item.route_id].wasteTypes[item.waste_type] || 0) + 1;
        });

        // Calculate predictions based on historical averages
        const routePredictions = Object.entries(routeStats)
          .map(([routeId, stats]) => {
            const avgDuration = stats.totalDuration / stats.count;
            const mostCommonWasteType = Object.entries(stats.wasteTypes)
              .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Mixed';

            return {
              route_id: routeId,
              predicted_duration: avgDuration.toFixed(2),
              total_collections: stats.count,
              most_common_waste: mostCommonWasteType,
              avg_duration: avgDuration.toFixed(2)
            };
          })
          .sort((a, b) => parseFloat(b.avg_duration) - parseFloat(a.avg_duration)) // Sort by duration
          .slice(0, 10); // Show top 10 routes

        console.log('Generated predictions:', routePredictions);
        setPredictions(routePredictions);

      } catch (err) {
        console.error('Error in fetchDataAndPredict:', err);
        setError('Failed to generate predictions');
      } finally {
        setLoading(false);
      }
    }

    fetchDataAndPredict();
  }, []);

  return (
    <div style={{
      width: '100%',
      padding: '20px',
      background: '#fff',
      borderRadius: 18,
      boxShadow: '0 2px 8px rgba(51,106,41,0.07)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
      }}>
        <h1 style={{
          color: '#336A29',
          fontSize: 24,
          fontWeight: 700,
          margin: 0
        }}>
          📊 Waste Collection Predictions
        </h1>
        <div style={{
          fontSize: 14,
          color: '#666',
          background: '#f8f9fa',
          padding: '4px 12px',
          borderRadius: 20,
          border: '1px solid #e9ecef'
        }}>
          Based on {predictions.length} routes
        </div>
      </div>

      {loading ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 400,
          flexDirection: 'column',
          gap: 16
        }}>
          <div style={{
            width: 40,
            height: 40,
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #336A29',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: '#666', margin: 0 }}>Analyzing collection data...</p>
        </div>
      ) : error ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 400,
          flexDirection: 'column',
          gap: 16
        }}>
          <div style={{
            fontSize: 48,
            color: '#dc3545'
          }}>
            ⚠️
          </div>
          <p style={{
            color: '#dc3545',
            margin: 0,
            textAlign: 'center',
            maxWidth: 400
          }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#336A29',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      ) : predictions.length === 0 ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 400,
          flexDirection: 'column',
          gap: 16
        }}>
          <div style={{
            fontSize: 48,
            color: '#6c757d'
          }}>
            📊
          </div>
          <p style={{
            color: '#6c757d',
            margin: 0,
            textAlign: 'center'
          }}>
            No prediction data available.<br />
            Add some collection records to see predictions.
          </p>
        </div>
      ) : (
        <div>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={predictions}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="route_id"
                angle={-45}
                textAnchor="end"
                height={80}
                stroke="#666"
                fontSize={12}
              />
              <YAxis
                label={{
                  value: 'Predicted Duration (Hours)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' }
                }}
                stroke="#666"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
                formatter={(value, name, props) => [
                  `${value} hours`,
                  `Route ${props.payload.route_id}`
                ]}
                labelFormatter={(label) => `Route: ${label}`}
              />
              <Bar
                dataKey="predicted_duration"
                fill="#336A29"
                radius={[4, 4, 0, 0]}
                name="Predicted Duration"
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Summary Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginTop: 20,
            padding: 20,
            background: '#f8f9fa',
            borderRadius: 12
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#336A29'
              }}>
                {predictions.length}
              </div>
              <div style={{
                fontSize: 14,
                color: '#666'
              }}>
                Active Routes
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#336A29'
              }}>
                {(predictions.reduce((sum, p) => sum + parseFloat(p.avg_duration), 0) / predictions.length).toFixed(1)}
              </div>
              <div style={{
                fontSize: 14,
                color: '#666'
              }}>
                Avg Duration (hrs)
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#336A29'
              }}>
                {predictions.reduce((sum, p) => sum + p.total_collections, 0)}
              </div>
              <div style={{
                fontSize: 14,
                color: '#666'
              }}>
                Total Collections
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
