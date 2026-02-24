
import React from 'react';

export const MonsterIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12,2C6.47,2,2,6.47,2,12s4.47,10,10,10,10-4.47,10-10S17.53,2,12,2ZM12,20c-4.41,0-8-3.59-8-8s3.59-8,8-8,8,3.59,8,8-3.59,8-8,8ZM8,9.5c0-.83,.67-1.5,1.5-1.5s1.5,.67,1.5,1.5-.67,1.5-1.5,1.5-1.5-.67-1.5-1.5ZM13,9.5c0-.83,.67-1.5,1.5-1.5s1.5,.67,1.5,1.5-.67,1.5-1.5,1.5-1.5-.67-1.5-1.5ZM12,17c-2.33,0-4.31-1.46-5.11-3.5h10.22c-.8,2.04-2.78,3.5-5.11,3.5Z"/>
  </svg>
);

export const RobotIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M15,9H9V11H15V9ZM15,13H9V15H15V13ZM20,9V7H18V5C18,3.9 17.1,3 16,3H8C6.9,3 6,3.9 6,5V7H4V9C2.9,9 2,9.9 2,11V15C2,16.1 2.9,17 4,17V19C4,20.1 4.9,21 6,21H18C19.1,21 20,20.1 20,19V17C21.1,17 22,16.1 22,15V11C22,9.9 21.1,9 20,9ZM18,19H6V5H18V19Z"/>
  </svg>
);

export const GhostIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12,2C8.13,2,5,5.13,5,9v11l2-2,2,2,2-2,2,2,2-2,2,2,2-2V9C19,5.13,15.87,2,12,2ZM15,11h-2V9h2V11ZM11,11H9V9h2V11Z"/>
  </svg>
);

export const StarIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/>
  </svg>
);

export const CHARACTER_TYPES = [
  { id: 'monster', icon: MonsterIcon, color: 'text-purple-500' },
  { id: 'robot', icon: RobotIcon, color: 'text-blue-500' },
  { id: 'ghost', icon: GhostIcon, color: 'text-pink-500' },
  { id: 'star', icon: StarIcon, color: 'text-yellow-500' },
];
