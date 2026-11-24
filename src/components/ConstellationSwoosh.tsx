import React from 'react';

interface ConstellationSwooshProps {
  variant?: 'header' | 'compact';
}

export const ConstellationSwoosh: React.FC<ConstellationSwooshProps> = ({
  variant = 'header',
}) => {
  if (variant === 'compact') {
    return (
      <div className="swoosh-strip swoosh-strip--compact" aria-hidden="true">
        <svg
          viewBox="0 0 680 28"
          preserveAspectRatio="none"
          className="swoosh-svg"
        >
          <path
            d="M -10 22 C 180 22, 340 4, 690 4"
            fill="none"
            stroke="#C83E2B"
            strokeWidth="4.2"
          />
          <path
            d="M -10 26.2 C 180 26.2, 340 8.2, 690 8.2"
            fill="none"
            stroke="#E0712A"
            strokeWidth="4.2"
          />
          <path
            d="M -10 30.4 C 180 30.4, 340 12.4, 690 12.4"
            fill="none"
            stroke="#E6B333"
            strokeWidth="4.2"
          />
          <path
            d="M -10 34.6 C 180 34.6, 340 16.6, 690 16.6"
            fill="none"
            stroke="#2B5F82"
            strokeWidth="4.2"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="swoosh-strip" aria-hidden="true">
      <svg
        viewBox="0 0 780 44"
        preserveAspectRatio="none"
        className="swoosh-svg"
      >
        <path
          d="M -20 34 C 220 34, 410 6, 800 6"
          fill="none"
          stroke="#C83E2B"
          strokeWidth="5.5"
        />
        <path
          d="M -20 39.5 C 220 39.5, 410 11.5, 800 11.5"
          fill="none"
          stroke="#E0712A"
          strokeWidth="5.5"
        />
        <path
          d="M -20 45 C 220 45, 410 17, 800 17"
          fill="none"
          stroke="#E6B333"
          strokeWidth="5.5"
        />
        <path
          d="M -20 50.5 C 220 50.5, 410 22.5, 800 22.5"
          fill="none"
          stroke="#2B5F82"
          strokeWidth="5.5"
        />
      </svg>
    </div>
  );
};
