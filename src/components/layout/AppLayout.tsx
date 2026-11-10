import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { SimulationBanner } from '../common/SimulationBanner';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-fintech-bg flex flex-col text-fintech-text">
      {/* Top Simulation Warning Banner */}
      <SimulationBanner />

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav />
    </div>
  );
};

