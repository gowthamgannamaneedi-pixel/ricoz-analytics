/**
 * Sample Data for RicozAnalytics Enterprise Dashboard
 * Structured to mirror the upcoming REST API responses for smooth data-layer migration.
 */

// KPI Overview Stats
export const dashboardStats = [
  {
    id: 'revenue',
    title: 'Revenue',
    value: '₹24.8L',
    change: '+18.2%',
    isPositive: true,
    period: 'vs last month',
    subtext: 'Target: ₹22.5L'
  },
  {
    id: 'orders',
    title: 'Orders',
    value: '1,420',
    change: '+12.4%',
    isPositive: true,
    period: 'vs last month',
    subtext: 'Avg. ₹1,746/order'
  },
  {
    id: 'customers',
    title: 'Customers',
    value: '3,840',
    change: '+8.1%',
    isPositive: true,
    period: 'vs last month',
    subtext: '624 new acquisitions'
  },
  {
    id: 'growth',
    title: 'Growth Rate',
    value: '22.5%',
    change: '-2.3%',
    isPositive: false,
    period: 'vs last quarter',
    subtext: 'Target: 25.0%'
  }
];

// 12-Month Revenue Trend (Line Chart Data)
export const revenueTrendData = [
  { month: 'Jan', revenue: 1250000, target: 1200000 },
  { month: 'Feb', revenue: 1400000, target: 1300000 },
  { month: 'Mar', revenue: 1350000, target: 1400000 },
  { month: 'Apr', revenue: 1600000, target: 1500000 },
  { month: 'May', revenue: 1800000, target: 1650000 },
  { month: 'Jun', revenue: 1750000, target: 1700000 },
  { month: 'Jul', revenue: 1950000, target: 1800000 },
  { month: 'Aug', revenue: 2100000, target: 1900000 },
  { month: 'Sep', revenue: 2050000, target: 2000000 },
  { month: 'Oct', revenue: 2280000, target: 2150000 },
  { month: 'Nov', revenue: 2350000, target: 2200000 },
  { month: 'Dec', revenue: 2480000, target: 2250000 }
];

// Sales Performance by Month (Bar Chart Data)
export const salesPerformanceData = [
  { month: 'Jul', online: 920, retail: 580, enterprise: 240 },
  { month: 'Aug', online: 1050, retail: 620, enterprise: 290 },
  { month: 'Sep', online: 980, retail: 610, enterprise: 310 },
  { month: 'Oct', online: 1120, retail: 700, enterprise: 340 },
  { month: 'Nov', online: 1200, retail: 750, enterprise: 380 },
  { month: 'Dec', online: 1340, retail: 820, enterprise: 420 }
];

// Regional Performance (Metrics across major Indian tech hubs)
export const regionalPerformanceData = [
  { region: 'Bengaluru', revenue: 840000, orders: 480, growth: 24 },
  { region: 'Mumbai', revenue: 620000, orders: 360, growth: 18 },
  { region: 'Delhi NCR', revenue: 510000, orders: 290, growth: 15 },
  { region: 'Hyderabad', revenue: 320000, orders: 190, growth: 21 },
  { region: 'Chennai', revenue: 190000, orders: 100, growth: 11 }
];

// Recent System Activities Timeline
export const recentActivities = [
  {
    id: 1,
    type: 'upload',
    title: 'New dataset imported',
    description: 'Q4_Transactions_2025.csv imported with 45,200 records',
    timestamp: '12 minutes ago',
    user: 'Aarav Sharma'
  },
  {
    id: 2,
    type: 'kpi',
    title: 'KPI threshold updated',
    description: 'Customer Acquisition Cost target updated to ₹420',
    timestamp: '1 hour ago',
    user: 'Priya Patel'
  },
  {
    id: 3,
    type: 'report',
    title: 'Executive report generated',
    description: 'Monthly Performance Summary Q4 generated and exported to PDF',
    timestamp: '3 hours ago',
    user: 'System Automated'
  },
  {
    id: 4,
    type: 'alert',
    title: 'Alert triggered',
    description: 'High traffic spike detected in South Zone (Hyderabad node)',
    timestamp: '5 hours ago',
    user: 'Alert Engine'
  }
];

// Filter Dropdown Options
export const filterOptions = {
  dateRanges: [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'ytd', label: 'Year to Date' },
    { value: 'all', label: 'All Time' }
  ],
  regions: [
    { value: 'all', label: 'All Regions' },
    { value: 'bengaluru', label: 'Bengaluru' },
    { value: 'mumbai', label: 'Mumbai' },
    { value: 'delhi', label: 'Delhi NCR' },
    { value: 'hyderabad', label: 'Hyderabad' },
    { value: 'chennai', label: 'Chennai' }
  ],
  categories: [
    { value: 'all', label: 'All Channels' },
    { value: 'online', label: 'Direct Online' },
    { value: 'retail', label: 'Retail Partners' },
    { value: 'enterprise', label: 'B2B Enterprise' }
  ]
};
