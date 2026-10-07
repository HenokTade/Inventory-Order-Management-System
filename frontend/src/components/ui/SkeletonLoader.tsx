import { cn } from '../../utils/helpers';

interface SkeletonLoaderProps {
  className?: string;
  height?: number | string;
  width?: number | string;
  round?: boolean;
}

export function SkeletonLoader({
  className = '',
  height = 16,
  width = '100%',
  round = false,
}: SkeletonLoaderProps) {
  const size = typeof height === 'number' ? `${height}px` : height;
  const widthSize = typeof width === 'number' ? `${width}px` : width;

  return (
    <div
      className={cn(
        'animate-pulse-loading bg-gray-200',
        round ? 'rounded-full' : 'rounded',
        className
      )}
      style={{
        height: size,
        width: widthSize,
      }}
    />
  );
}