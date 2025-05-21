import { usePage } from '@/contexts/PageContext';
import Dashboard from "./Dashboard";
import Profile from "./profile";
// import Matches from "./matches";
// import Players from "./players";
// import Statistics from "./statistics";

export default function Home() {
  const { activePage } = usePage();

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'profile':
        return <Profile />;
      // case 'matches':
      //   return <Matches />;
      // case 'players':
      //   return <Players />;
      // case 'statistics':
      //   return <Statistics />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {renderPage()}
    </div>
  );
} 