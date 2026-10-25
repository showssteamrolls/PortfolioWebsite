import React, { useState } from "react";
import ProgressBar, { PALETTE } from "../ProgressBar";
import "./index.scss"

const TechList = () => {
  // bar width = years / 3 (the longest bar)
  const [techs] = useState([
    { name: "scikit-learn", years: 3, progress: 100 },
    { name: "pandas", years: 3, progress: 100 },
    { name: "NumPy", years: 3, progress: 100 },
    { name: "Matplotlib", years: 3, progress: 100 },
    { name: "Statsmodels", years: 2, progress: 66.6667 },
    { name: "MySQL & PostgreSQL", years: 1.5, progress: 50 },
    { name: "TensorFlow", years: 1, progress: 33.3333 },
    { name: "PyTorch", years: 1, progress: 33.3333 },
    { name: "Optuna", years: 1, progress: 33.3333 },
    { name: "Polars", years: 1, progress: 33.3333 }
  ]);

  return (
    <div>
      <h2>Frameworks & Technologies</h2>
      <ul>
        {techs.map((tech, index) => (
          <li key={index}>
            <span>{tech.name}: {`${tech.years} years`}</span>
            <ProgressBar progress={tech.progress} className="" color={PALETTE[index % PALETTE.length]} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TechList;
