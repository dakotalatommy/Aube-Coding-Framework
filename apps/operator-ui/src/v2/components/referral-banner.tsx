import { useState } from 'react'
import { Check, Copy, DollarSign, Gift, QrCode, Share2, Sparkles } from 'lucide-react'

import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { toast } from 'sonner'
import type { DashboardReferralInfo } from '../types/dashboard'

interface ReferralBannerProps {
  referral?: DashboardReferralInfo | null
  loading?: boolean
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function ReferralBanner({ referral, loading = false }: ReferralBannerProps) {
  const [copied, setCopied] = useState(false)
  const shareUrl = referral?.shareUrl ?? ''
  const monthlySavingsCents = referral?.monthlySavingsCents ?? 5000
  const annualSavingsCents = monthlySavingsCents * 12

  const copyToClipboard = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Referral link copied to clipboard!')
      window.setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy link')
    }
  }

  const downloadQrCode = async () => {
    const qrUrl = referral?.qrUrl
    if (!qrUrl) {
      toast.error('QR code not available')
      return
    }
    
    try {
      // Fetch the QR image
      const response = await fetch(qrUrl)
      if (!response.ok) throw new Error('Failed to fetch QR code')
      
      // Convert to blob
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `brandvx-referral-${referral?.code || 'qr'}.png`
      
      // Trigger download
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('QR code downloaded!')
    } catch (error) {
      console.error('QR download error:', error)
      toast.error('Failed to download QR code')
    }
  }

  return (
    <Card
      className="relative overflow-hidden border-2 border-primary"
      style={{ background: 'linear-gradient(to right, #F3F3F3, #F7B8D1)' }}
    >
      <CardContent className="p-6">
        {loading ? (
          <div className="h-24 rounded-lg border border-dashed border-muted-foreground/20 bg-muted" />
        ) : shareUrl ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center space-x-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent">
                <Gift className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center space-x-2">
                  <h3 className="font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Share BVX & Save Big!
                  </h3>
                  <Badge className="bg-accent text-white">
                    {currencyFormatter.format(monthlySavingsCents / 100)} / month
                  </Badge>
                </div>
                <p className="mb-2 text-sm text-gray-600" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Invite another beauty professional and lock in exclusive pricing for your studio.
                </p>
                <div className="flex items-center space-x-2 rounded-md border-2 border-accent bg-white p-2">
                  <code className="flex-1 truncate text-xs text-gray-700">{shareUrl}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-accent hover:bg-blue-50"
                    onClick={copyToClipboard}
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <Button className="flex items-center space-x-2 bg-primary text-white" onClick={copyToClipboard}>
                <Share2 className="h-4 w-4" />
                <span>Share Link</span>
              </Button>
              <Button 
                className="flex items-center space-x-2 bg-primary text-white" 
                onClick={downloadQrCode}
                disabled={!referral?.qrUrl}
              >
                <QrCode className="h-4 w-4" />
                <span>Share QR Code</span>
              </Button>
              <div className="flex items-center space-x-1 text-xs text-accent">
                <DollarSign className="h-3 w-3" />
                <span className="font-medium">
                  {currencyFormatter.format(annualSavingsCents / 100)} saved annually
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2 text-center text-sm text-muted-foreground">
            <Sparkles className="h-5 w-5" />
            <p>Create a referral link to unlock savings.</p>
          </div>
        )}

        <div
          className="absolute right-0 top-0 h-32 w-32 -translate-y-16 translate-x-16 rounded-full"
          style={{ background: 'linear-gradient(to bottom left, rgba(224, 60, 145, 0.1), transparent)' }}
        />
        <div
          className="absolute bottom-0 left-0 h-24 w-24 translate-y-12 -translate-x-12 rounded-full"
          style={{ background: 'linear-gradient(to top right, rgba(47, 93, 159, 0.1), transparent)' }}
        />
      </CardContent>
    </Card>
  )
}
