import * as React from 'react';

export type TrendDirection = 'up' | 'down' | 'neutral';

export type StatusTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

export type MetricDisplayValue = string | number;

export type CardVariant = 'default' | 'elevated' | 'subtle' | 'glass';

export type ComponentSize = 'sm' | 'md' | 'lg' | 'xl';

export type AIMessageType = 'user' | 'assistant' | 'system' | 'tool' | 'error';

export type AIThinkingStatus =
  | 'thinking'
  | 'searching'
  | 'analyzing'
  | 'generating'
  | 'finalizing';

export type DeviceMetricSummary = {
  label: string;
  value: string | number;
  tone?: StatusTone;
};

export type DataSummaryItem = {
  label: React.ReactNode;
  value: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatusTone;
};
