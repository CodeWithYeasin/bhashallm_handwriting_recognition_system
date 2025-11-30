import React from 'react';

interface BhashaLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

const BhashaLogo: React.FC<BhashaLogoProps> = ({ className, ...props }) => {
  return (
    <svg 
      viewBox="0 0 320 180" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00C2FF"/>
          <stop offset="100%" stopColor="#0066FF"/>
        </linearGradient>
      </defs>

      {/* Symbol Group - Centered */}
      <g transform="translate(160,55)">
        {/* Main B shape with cutout using evenodd fill rule */}
        <path 
          d="M-35,20 
             C-35,0 -20,-15 0,-15 
             C25,-15 40,0 40,20 
             C40,35 30,45 15,48 
             C35,52 45,65 45,80 
             C45,105 25,115 0,115 
             C-25,115 -40,95 -40,70 
             L-40,20 
             Z
             
             M-25,25 
             C-25,10 -12,0 5,0 
             C20,0 30,10 30,22 
             C30,32 23,38 12,40 
             C25,43 32,52 32,68 
             C32,90 18,100 0,100 
             C-18,100 -28,88 -28,70 
             L-28,25 
             Z" 
          fill="currentColor"
          fillRule="evenodd"
        />

        {/* Sound wave / AI accent on the left */}
        <g fill="#00C2FF">
          <circle cx="-50" cy="-10" r="4"/>
          <rect x="-55" y="-20" width="6" height="40" rx="3"/>
          <rect x="-65" y="-12" width="6" height="24" rx="3"/>
          <rect x="-75" y="-5" width="6" height="10" rx="3"/>
        </g>

        {/* Gradient swoosh under the B */}
        <path d="M-20,-35 Q10,-45 45,-20 
             Q40,0 20,10 
             Q0,15 -25,5 
             Q-40,-10 -20,-35" 
          fill="url(#logo-gradient)" opacity="0.7"/>
      </g>

      {/* Text: BHASHA.LLM */}
      <text x="160" y="130" fontFamily="Arial, Helvetica, sans-serif" 
            fontSize="36" fontWeight="bold" fill="currentColor" 
            textAnchor="middle" letterSpacing="4">
        BHASHA.LLM
      </text>
    </svg>
  );
};

export default BhashaLogo;