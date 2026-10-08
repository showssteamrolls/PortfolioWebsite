import React, { useState } from "react";
import ProgressBar from "../ProgressBar";
import "./index.scss"

const LanguageList = () => {
  const [languages] = useState([
    { name: "Python", className: "bar-red", years: 3.5 },
    { name: "SQL", className: "bar-blue", years: 2 },
    { name: "HTML/CSS", className: "bar-yellow", years: 2 },
  ]);
  const maxYears = Math.max(...languages.map((l) => l.years));

  return (
    <div>
      <h2>Languages</h2>
      <ul>
        {languages.map((language, index) => (
          <li key={index}>
            <span>{language.name}: {`${language.years} years`}</span>
            <ProgressBar progress={(language.years / maxYears) * 100} className={language.className} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LanguageList;
