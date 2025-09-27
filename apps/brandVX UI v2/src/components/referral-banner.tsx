import { useState } from 'react'
import { Share2, Copy, Check, Gift, DollarSign } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { toast } from "sonner@2.0.3"

const REFERRAL_LINK = "https://vxbeauty.com/ref/sarah-williams-2024"

export function ReferralBanner() {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(REFERRAL_LINK)
      setCopied(true)
      toast.success("Referral link copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy link")
    }
  }

  return (
    <Card className="relative overflow-hidden border-2 border-primary" style={{ background: 'linear-gradient(to right, #F3F3F3, #F7B8D1)' }}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center">
                <Gift className="h-6 w-6 text-white" />
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>Share BVX & Save Big!</h3>
                <Badge className="text-white bg-accent">
                  Save $50/month
                </Badge>
              </div>
              
              <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Share your referral link and get <span className="font-semibold text-primary">$97/month</span> instead of <span className="line-through text-gray-500">$147/month</span>
              </p>
              
              <div className="flex items-center space-x-2 p-2 bg-white rounded-md border-2 border-accent">
                <code className="flex-1 text-xs text-gray-700 truncate">
                  {REFERRAL_LINK}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyToClipboard}
                  className="h-6 px-2 hover:bg-blue-50 text-accent"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col space-y-2 items-end">
            <Button 
              className="bg-primary text-white flex items-center space-x-2"
              onClick={copyToClipboard}
            >
              <Share2 className="h-4 w-4" />
              <span>Share Link</span>
            </Button>
            
            <div className="flex items-center space-x-1 text-xs text-accent">
              <DollarSign className="h-3 w-3" />
              <span className="font-medium">$600 saved annually</span>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16" style={{ background: 'linear-gradient(to bottom left, rgba(224, 60, 145, 0.1), transparent)' }}></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full translate-y-12 -translate-x-12" style={{ background: 'linear-gradient(to top right, rgba(47, 93, 159, 0.1), transparent)' }}></div>
      </CardContent>
    </Card>
  )
}