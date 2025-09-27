import { ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { BeforeAfterSlider } from './before-after-slider'

interface ConsultationResultsProps {
  beforeImageUrl: string
  afterImageUrl: string
  promptText: string
  onBackToConsultation: () => void
  onNewConsultation: () => void
}

export function ConsultationResults({ 
  beforeImageUrl, 
  afterImageUrl, 
  promptText, 
  onBackToConsultation,
  onNewConsultation 
}: ConsultationResultsProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" onClick={onBackToConsultation}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to BrandVZN
        </Button>
        <div>
          <h1 className="font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
            Consultation Results
          </h1>
          <p className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            AI-powered beauty transformation preview
          </p>
        </div>
      </div>

      {/* Main Results Card */}
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>
              AI Transformation Result
            </CardTitle>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Generated
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Large Interactive Before/After Slider Optimized for Mobile */}
          <div className="space-y-6">
            {/* Large result image optimized for mobile viewing */}
            <div className="w-full max-w-3xl mx-auto">
              <div className="aspect-square rounded-lg overflow-hidden">
                <BeforeAfterSlider
                  beforeImage={beforeImageUrl}
                  afterImage={afterImageUrl}
                  beforeAlt="Original Photo"
                  afterAlt="AI Transformation"
                  className="w-full h-full"
                />
              </div>
            </div>
            
            <p className="text-center text-muted-foreground max-w-md mx-auto">
              Drag the slider to compare the original photo with your AI-generated transformation
            </p>
            
            {/* Show the client request */}
            {promptText && (
              <div className="mt-8 p-6 bg-muted/30 rounded-lg max-w-2xl mx-auto">
                <p className="font-medium text-primary text-center mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Client Request
                </p>
                <p className="text-muted-foreground text-center italic">
                  "{promptText}"
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10 max-w-lg mx-auto">
            <Button 
              variant="outline" 
              onClick={onNewConsultation} 
              className="flex-1"
            >
              New Consultation
            </Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90">
              Save to Client Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Additional Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <h3 className="font-medium mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Share with Client
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Send this transformation preview directly to your client's phone
            </p>
            <Button variant="outline" size="sm">
              Share Results
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <h3 className="font-medium mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Book Appointment
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Schedule an appointment to bring this transformation to life
            </p>
            <Button variant="outline" size="sm">
              Schedule Now
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}