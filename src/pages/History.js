import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import PageHero from "../components/PageHero";
import { Skeleton } from "../components/ui/skeleton";
import "./History.css";

const History = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchCollections = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from("collections")
          .select("*")
          .order("collected_at", { ascending: false });

        if (fetchError) {
          console.error("Error fetching collection history:", fetchError);
          setError("Failed to load collection history.");
          return;
        }

        if (isMounted) {
          setCollections(data || []);
          setError("");
        }
      } catch (err) {
        console.error("Unexpected error fetching history:", err);
        setError("Failed to load collection history.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCollections();

    const channel = supabase
      .channel("history-collections")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collections" },
        () => fetchCollections()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredCollections = useMemo(() => {
    return (collections || []).filter((collection) => {
      const matchesSearch =
        !search ||
        (collection.collector_name || "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (Array.isArray(collection.areas_collected)
          ? collection.areas_collected.join(", ")
          : collection.areas_collected || ""
        )
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesDate =
        !dateFilter ||
        (collection.collected_date &&
          collection.collected_date === dateFilter);

      return matchesSearch && matchesDate;
    });
  }, [collections, search, dateFilter]);

  return (
    <div className="history-page">
      <PageHero
        eyebrow="Collections archive"
        title="History"
        subtitle="Review past collection runs and download records when needed."
      />

      <section className="history-filters">
        <div className="history-filter-group">
          <label htmlFor="history-search">Search collector / barangay</label>
          <input
            id="history-search"
            type="text"
            placeholder="e.g. Sto. Nino or Ricky Francisco"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="history-filter-group">
          <label htmlFor="history-date">Filter by date</label>
          <input
            id="history-date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
      </section>

      <section className="history-card">
        <header className="history-card__header">
          <div>
            <h3>Completed collections</h3>
            <p>
              Showing {filteredCollections.length} of {collections.length} total
              records
            </p>
          </div>
        </header>

        {error && <div className="history-error">{error}</div>}

        <div className="history-table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>Collector</th>
                <th>Areas covered</th>
                <th>Waste type</th>
                <th>Collected date</th>
                <th>Collected time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, index) => (
                  <tr key={index}>
                    <td>
                      <Skeleton style={{ height: '20px', width: '150px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '20px', width: '200px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '20px', width: '100px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '20px', width: '120px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '20px', width: '100px' }} />
                    </td>
                  </tr>
                ))
              ) : filteredCollections.length === 0 ? (
                <tr>
                  <td colSpan="5" className="history-empty">
                    No records match your filters.
                  </td>
                </tr>
              ) : (
                filteredCollections.map((collection) => (
                  <tr key={collection.id}>
                    <td>{collection.collector_name || "Unknown"}</td>
                    <td>
                      {Array.isArray(collection.areas_collected)
                        ? collection.areas_collected.join(", ")
                        : collection.areas_collected || "N/A"}
                    </td>
                    <td>{collection.waste_type || "N/A"}</td>
                    <td>
                      {collection.collected_date
                        ? new Date(
                            collection.collected_date
                          ).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td>
                      {collection.collected_at
                        ? new Date(collection.collected_at).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" }
                          )
                        : "N/A"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default History;