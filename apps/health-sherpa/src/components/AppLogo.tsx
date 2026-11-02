'use client';

import { Stethoscope } from 'lucide-react';

interface AppLogoProps {
  className?: string;
}

const AppLogo: React.FC<AppLogoProps> = ({ className }) => {
  return (
    <div className={`flex items-center text-primary ${className}`}>
      <Stethoscope className="h-8 w-8 mr-2" />
      <h1 className="text-2xl font-bold tracking-tight">
        Health <span className="text-accent-foreground/80">Sherpa</span>
      </h1>
    </div>
  );
};

export default AppLogo;
