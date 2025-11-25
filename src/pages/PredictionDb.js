/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { trainAndPredict, hashToNumber, normalize } from '../garbagepredict';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

import { supabase } from '../supabaseClient';


export default function Dashboard() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDataAndPredict() {
      const { data, error } = await supabase
        .from('collections')
        .select('route_id, waste_type, created_at, collected_at')
        .not('collected_at', 'is', null);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      // Convert to durations in hours
      const formattedData = data.map(row => ({
        route_id: row.route_id,
        waste_type: row.waste_type,
        collection_duration: (new Date(row.collected_at) - new Date(row.created_at)) / (1000 * 3600),
      }));

      // Get unique routes
      const uniqueRoutes = [...new Set(formattedData.map(d => d.route_id))];

      // Predict for each route
      const routePredictions = [];
      for (const route of uniqueRoutes) {
        const routeData = formattedData.filter(d => d.route_id === route);
        const pred = await trainAndPredict(routeData);
        routePredictions.push({
          route_id: route,
          predicted_duration: pred ? pred.toFixed(2) : 0,
        });
      }

      setPredictions(routePredictions);
      setLoading(false);
    }

    fetchDataAndPredict();
  }, []);

  return (
    <div style={{ width: '100%', height: 400 }}>
      <h1>GarbagePrediction</h1>
      {loading ? (
        <p>Loading predictions...</p>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={predictions} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="route_id" />
            <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="predicted_duration" fill="#82ca9d" name="Predicted Duration" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
