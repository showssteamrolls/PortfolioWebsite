import React, { useState } from "react";
import ProgressBar, { PALETTE } from "../ProgressBar";
import "./index.scss"

const LanguageList = () => {
  const [languages] = useState([
    { name: "Python", progress: 100, className: "java-progress", years: 3 },
    { name: "SQL", progress: 67, className: "python-progress", years: 2 },
    { name: "HTML/CSS", progress: 67, className: "web-progress", years: 2 },
    { name: "R", progress: 50, className: "r-progress", years: 1.5 },
    { name: "JavaScript", progress: 50, className: "js-progress", years: 1.5 },
  ]);

  return (
    <div>
      <h2>Languages</h2>
      <ul>
        {languages.map((language, index) => (
          <li key={index}>
            <span>{language.name}: {`${language.years} years`}</span>
            <ProgressBar progress={language.progress} className={language.className} color={PALETTE[index % PALETTE.length]} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LanguageList;
