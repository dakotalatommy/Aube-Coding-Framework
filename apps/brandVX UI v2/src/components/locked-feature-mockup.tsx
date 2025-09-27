import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  TrendingUp, 
  Users, 
  MousePointer, 
  BarChart3,
  Target,
  Calendar,
  Mail,
  Globe
} from 'lucide-react'

interface MockupProps {
  type: 'fill-your-chair' | 'grow-with-vx'
}

export function LockedFeatureMockup({ type }: MockupProps) {
  if (type === 'fill-your-chair') {
    return (
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-muted/50 p-1 rounded-lg">
          <Button variant="default" size="sm">Link in Bio</Button>
          <Button variant="ghost" size="sm">Landing Pages</Button>
          <Button variant="ghost" size="sm">Analytics</Button>
        </div>

        {/* Link in Bio Builder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Bio Link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Name</label>
                  <div className="h-10 bg-muted rounded-md border"></div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bio Description</label>
                  <div className="h-20 bg-muted rounded-md border"></div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Profile Image</label>
                  <div className="h-24 w-24 bg-muted rounded-full border"></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 border rounded-lg bg-muted/30">
                    <div className="w-8 h-8 bg-primary/20 rounded"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-3/4 mb-1"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
                <Badge className="w-fit">bvx.app/your-business</Badge>
              </CardHeader>
              <CardContent>
                <div className="w-full max-w-sm mx-auto bg-background border rounded-3xl p-6 shadow-lg">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-primary/20 rounded-full mx-auto"></div>
                    <div>
                      <div className="h-5 bg-muted rounded w-32 mx-auto mb-2"></div>
                      <div className="h-3 bg-muted rounded w-48 mx-auto"></div>
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-12 bg-primary/10 rounded-lg border border-primary/20"></div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">2.4K</div>
                    <div className="text-sm text-muted-foreground">Link Clicks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">18%</div>
                    <div className="text-sm text-muted-foreground">Conversion</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Grow With VX mockup
  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campaign Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">+24%</div>
            <p className="text-xs text-muted-foreground">vs last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">2 launching soon</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">156</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>Email Automation</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                'Welcome Series (5 emails)',
                'Birthday Campaign',
                'Re-engagement Flow',
                'Post-Visit Follow-up'
              ].map((campaign, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium">{campaign}</span>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Scheduled Posts</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                { time: '9:00 AM', content: 'Monday Motivation Post', platform: 'Instagram' },
                { time: '2:00 PM', content: 'Before/After Feature', platform: 'Facebook' },
                { time: '5:00 PM', content: 'Skincare Tip Video', platform: 'TikTok' },
                { time: '7:00 PM', content: 'Client Testimonial', platform: 'Instagram' }
              ].map((post, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div>
                    <div className="font-medium">{post.content}</div>
                    <div className="text-sm text-muted-foreground">{post.time} • {post.platform}</div>
                  </div>
                  <div className="w-8 h-8 bg-primary/20 rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Growth Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Interactive Analytics Dashboard</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}