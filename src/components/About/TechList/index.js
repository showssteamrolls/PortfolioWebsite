import React, { useState } from "react";
import ProgressBar from "../ProgressBar";
import "./index.scss"

const TechList = () => {
  const [techs] = useState([
    { name: "scikit-learn", className: "bar-red", years: 4 },
    { name: "pandas", className: "bar-blue", years: 4 },
    { name: "NumPy", className: "bar-yellow", years: 4 },
    { name: "matplotlib", className: "bar-red", years: 3 },
    { name: "MySQL & PostgreSQL", className: "bar-blue", years: 2.5 },
    { name: "Keras", className: "bar-yellow", years: 1 },
    { name: "TensorFlow", className: "bar-red", years: 1 },
    { name: "Polars", className: "bar-blue", years: 0.5 }
  ]);
  const maxYears = Math.max(...techs.map((t) => t.years));

  return (
    <div>
      <h2>Frameworks & Technologies</h2>
      <ul>
        {techs.map((tech, index) => (
          <li key={index}>
            <span>{tech.name}: {`${tech.years} years`}</span>
            <ProgressBar progress={(tech.years / maxYears) * 100} className={tech.className} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TechList;
