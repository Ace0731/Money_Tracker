import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './screens/Dashboard';
import Transactions from './screens/Transactions';
import Accounts from './screens/Accounts';
import Categories from './screens/Categories';
import Projects from './screens/Projects';
import Investments from './screens/Investments';
import Reports from './screens/Reports';
import IncomeBreakdown from './screens/IncomeBreakdown';
import Settings from './screens/Settings';

function App() {
    useEffect(() => {
        console.log('Money Tracker initialized');
    }, []);

    return (
        <Router>
            <Layout>
                <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/accounts" element={<Accounts />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/investments" element={<Investments />} />
                    <Route path="/reports" element={<Reports />} />

                    <Route path="/income-breakdown" element={<IncomeBreakdown />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </Layout>
        </Router>
    );
}

export default App;
