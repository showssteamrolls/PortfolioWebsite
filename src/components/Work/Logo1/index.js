import React from 'react';
import Work from '../../../assets/images/signature.png';
import './index.scss';

const Logo1 = () => {
  return (
    <div className="job1-logo-container">
      <img className="solid-logo animated fadeIn" src={Work} alt="Work Experience" />
      <svg
        className="svg-container animated fadeIn"
        version="1.0"
        width="512.000000pt"
        height="512.000000pt"
        viewBox="0 0 512.000000 512.000000"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform="translate(0.000000, 512.000000) scale(0.100000, -0.100000)" fill="none">
         
        </g>
      </svg>
    </div>
  );
};

export default Logo1;
