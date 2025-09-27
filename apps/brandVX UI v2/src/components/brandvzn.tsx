import { useState, useEffect } from 'react'
import { Upload, Sparkles, Camera, Eye, Download, Share2, RotateCcw, Zap, MessageSquare, Wand2 } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { ImageWithFallback } from './figma/ImageWithFallback'
import { BeforeAfterSlider } from './before-after-slider'

interface BrandVZNProps {
  onConsultationGenerated: (data: { beforeImageUrl: string; afterImageUrl: string; promptText: string }) => void
}

export function BrandVZN({ onConsultationGenerated }: BrandVZNProps) {
  const [promptText, setPromptText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [hasBeforeImage, setHasBeforeImage] = useState(false)

  const [beforeImageUrl, setBeforeImageUrl] = useState('')
  const [afterImageUrl, setAfterImageUrl] = useState('')
  const [processingComplete, setProcessingComplete] = useState(false)

  // Handle navigation when processing is complete
  useEffect(() => {
    if (processingComplete && afterImageUrl) {
      onConsultationGenerated({
        beforeImageUrl,
        afterImageUrl,
        promptText
      })
      setProcessingComplete(false) // Reset for next time
    }
  }, [processingComplete, afterImageUrl, beforeImageUrl, promptText, onConsultationGenerated])

  const handleImageUpload = () => {
    setHasBeforeImage(true)
    // Set the before image (in real app, this would be the uploaded image)
    setBeforeImageUrl("https://images.unsplash.com/photo-1600637070413-0798fafbb6c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYWtldXAlMjBhcnRpc3R8ZW58MXx8fHwxNzU4NjU0MTcxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral")
  }

  const generateVisualization = () => {
    if (!promptText.trim()) return
    
    setIsProcessing(true)
    setProcessingProgress(0)
    
    // Simulate AI processing with more realistic timing
    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsProcessing(false)
          
          // Set the after image
          const generatedAfterImageUrl = "https://images.unsplash.com/photo-1610207928705-0ecd72bd4b6e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWF1dHklMjBjb25zdWx0YXRpb24lMjBiZWZvcmUlMjBhZnRlcnxlbnwxfHx8fDE3NTg2NTQxNjV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          setAfterImageUrl(generatedAfterImageUrl)
          
          // Trigger navigation via useEffect
          setProcessingComplete(true)
          
          return 100
        }
        return prev + 8
      })
    }, 400)
  }

  const resetConsultation = () => {
    setHasBeforeImage(false)
    setPromptText('')
    setProcessingProgress(0)
    setBeforeImageUrl('')
    setAfterImageUrl('')
    setProcessingComplete(false)
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            BrandVZN
          </h1>
          <p className="text-lg text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            AI-Powered Beauty Consultation & Visualization
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {!hasBeforeImage ? (
            <Button 
              onClick={handleImageUpload}
              className="bg-primary hover:bg-primary/90"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Photo
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm"
              onClick={resetConsultation}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Change Photo
            </Button>
          )}
          <Badge variant="secondary" className="bg-accent text-accent-foreground">
            <Zap className="h-3 w-3 mr-1" />
            AI Powered
          </Badge>
          <Badge variant="outline" className="border-primary text-primary">
            Pro Feature
          </Badge>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column - Controls */}
        <div className="xl:col-span-1 space-y-6">
          
          {/* Client Photo Preview - Only show when image exists */}
          {hasBeforeImage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <Camera className="h-5 w-5 mr-2" />
                  Client Photo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                  <ImageWithFallback 
                    src="https://images.unsplash.com/photo-1600637070413-0798fafbb6c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYWtldXAlMjBhcnRpc3R8ZW58MXx8fHwxNzU4NjU0MTcxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                    alt="Client before photo"
                    className="w-full h-full object-cover"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Prompt Input */}
          {hasBeforeImage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Describe the Change
                </CardTitle>
                <CardDescription>
                  Tell the AI what visual transformation you want to see
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="prompt-text" className="text-sm font-medium">
                    What change would you like to make?
                  </Label>
                  <Textarea
                    id="prompt-text"
                    placeholder="E.g., 'Give her long, voluminous curls with blonde highlights' or 'Apply dramatic winged eyeliner with smoky eyeshadow' or 'French manicure with subtle glitter accent'"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    className="min-h-[120px] resize-none text-base border-2 focus:border-primary transition-colors"
                  />
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <Wand2 className="h-3 w-3" />
                    <span>Be specific about colors, styles, and techniques for best results</span>
                  </div>
                </div>

                {/* Generate Button */}
                {promptText.trim() && (
                  <div className="mt-6">
                    <Button 
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" 
                      onClick={generateVisualization}
                      disabled={isProcessing}
                      size="lg"
                    >
                      <Sparkles className="h-5 w-5 mr-2" />
                      {isProcessing ? 'AI Processing...' : 'Generate Transformation'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Results & Preview */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Processing State */}
          {isProcessing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <Sparkles className="h-5 w-5 mr-2 animate-spin" />
                  AI Processing
                </CardTitle>
                <CardDescription>
                  Our AI is creating your client's new look...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Progress value={processingProgress} className="w-full" />
                  <p className="text-sm text-center text-muted-foreground">
                    {processingProgress < 25 && "Analyzing facial features and skin tone..."}
                    {processingProgress >= 25 && processingProgress < 50 && "Understanding style requirements..."}
                    {processingProgress >= 50 && processingProgress < 75 && "Generating AI transformation..."}
                    {processingProgress >= 75 && processingProgress < 95 && "Applying final details..."}
                    {processingProgress >= 95 && "Finalizing your consultation!"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}



          {/* Welcome/Instructions Card */}
          {!hasBeforeImage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-center text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Welcome to BrandVZN
                </CardTitle>
                <CardDescription className="text-center">
                  Transform consultations with AI-powered before & after visualizations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  
                  {/* Hero Image */}
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <ImageWithFallback 
                      src="https://images.unsplash.com/photo-1610207928705-0ecd72bd4b6e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhaSUyMGJlYXV0eSUyMHRlY2hub2xvZ3l8ZW58MXx8fHwxNzU4NjU0MTY4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                      alt="AI Beauty Technology"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Features List */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4">
                      <Camera className="h-8 w-8 mx-auto text-primary mb-2" />
                      <h4 className="font-medium mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>Upload Photo</h4>
                      <p className="text-sm text-muted-foreground">Start with your client's before photo</p>
                    </div>
                    <div className="text-center p-4">
                      <MessageSquare className="h-8 w-8 mx-auto text-primary mb-2" />
                      <h4 className="font-medium mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>Describe Change</h4>
                      <p className="text-sm text-muted-foreground">Tell AI what transformation you want</p>
                    </div>
                    <div className="text-center p-4">
                      <Sparkles className="h-8 w-8 mx-auto text-primary mb-2" />
                      <h4 className="font-medium mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>AI Magic</h4>
                      <p className="text-sm text-muted-foreground">See the transformation instantly</p>
                    </div>
                  </div>

                  <div className="text-center">
                    <Button size="lg" className="px-8">
                      Get Started
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}