import React from "react";
import "../App.css";

const PageHero = ({ eyebrow, title, subtitle, action }) => {
  return (
    <section className="page-hero">
      <div className="page-hero-text">
        {eyebrow && <p className="page-hero-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {action && <div className="page-hero-actions">{action}</div>}
    </section>
  );
};

export default PageHero;