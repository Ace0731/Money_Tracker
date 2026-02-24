import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './screens/Dashboard';
import Transactions from './screens/Transactions';
import Accounts from './screens/Accounts';
import Categories from './screens/Categories';
import Clients from './screens/Clients';
import Projects from './screens/Projects';
import Reports from './screens/Reports';
import Investments from './screens/Investments';
import Budget from './screens/Budget';
import Quotations from './screens/Quotations';
import Invoices from './screens/Invoices';
import Settings from './screens/Settings';
import DecisionMaker from './screens/DecisionMaker';

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
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/quotations" element={<Quotations />} />
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="/investments" element={<Investments />} />
                    <Route path="/budget" element={<Budget />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/decision-maker" element={<DecisionMaker />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </Layout>
        </Router>
    );
}

export default App;

