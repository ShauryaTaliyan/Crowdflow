import React from 'react';

export default function StatCard({
  label,
  value,
  unit,
  subLabel,
  icon: Icon,
  variant = 'default', // default, alert, warning, success, info
  onClick,
}) {
  return (
    <div className={`cf-stat-card variant-${variant} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="stat-card-header">
        <span className="stat-label">{label}</span>
        {Icon && (
          <div className="stat-icon-wrapper">
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="stat-value-container">
        <span className="stat-value">{value}</span>
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {subLabel && <div className="stat-sub">{subLabel}</div>}
    </div>
  );
}
