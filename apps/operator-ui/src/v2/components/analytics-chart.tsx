// @ts-nocheck
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

const revenueData = [
  { month: 'Jan', revenue: 8400, appointments: 45 },
  { month: 'Feb', revenue: 9200, appointments: 52 },
  { month: 'Mar', revenue: 10100, appointments: 58 },
  { month: 'Apr', revenue: 11800, appointments: 67 },
  { month: 'May', revenue: 12200, appointments: 71 },
  { month: 'Jun', revenue: 12540, appointments: 73 },
]

const serviceData = [
  { service: 'Facials', bookings: 89, revenue: 4200 },
  { service: 'Hair Styling', bookings: 67, revenue: 3100 },
  { service: 'Manicure', bookings: 54, revenue: 2400 },
  { service: 'Massage', bookings: 43, revenue: 2100 },
  { service: 'Makeup', bookings: 32, revenue: 1800 },
]

export function AnalyticsChart() {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Analytics Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList>
            <TabsTrigger value="revenue">Revenue Trend</TabsTrigger>
            <TabsTrigger value="services">Service Performance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="revenue" className="space-y-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'revenue' ? `$${value}` : value,
                      name === 'revenue' ? 'Revenue' : 'Appointments'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={{ fill: '#8884d8' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="appointments" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                    dot={{ fill: '#82ca9d' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="services" className="space-y-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="service" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="bookings" fill="#8884d8" name="Bookings" />
                  <Bar dataKey="revenue" fill="#82ca9d" name="Revenue ($)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}