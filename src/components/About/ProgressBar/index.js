import React from "react";
import "./index.scss"

// One muted palette for every bar on the site, picked by position in the list.
export const PALETTE = ["#6E9FFF", "#FF8C84", "#80DBA7", "#FFC966", "#A993FF", "#64D2DE"];

const ProgressBar = ({ progress, className, color }) => {
  const progressBarStyles = {
    width: `${progress}%`,
    ...(color ? { backgroundColor: color } : {}),
  };

  return (
    <div className={`progress-bar ${className}`}>
      <div className="progress" style={progressBarStyles}></div>
    </div>
  );
};

export default ProgressBar;
