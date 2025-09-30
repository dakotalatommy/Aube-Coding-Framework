// @ts-nocheck
import { useState, useEffect, useRef } from 'react'
import { Upload, Sparkles, Camera, Eye, Download, Share2, RotateCcw, Zap, MessageSquare, Wand2, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { ImageWithFallback } from './figma/ImageWithFallback'
import { BeforeAfterSlider } from './before-after-slider'
import { api } from '../../lib/api'

interface BrandVZNProps {
  onConsultationGenerated: (data: { beforeImageUrl: string; afterImageUrl: string; promptText: string }) => void
}

export function BrandVZN({ onConsultationGenerated }: BrandVZNProps) {
  const [promptText, setPromptText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [hasBeforeImage, setHasBeforeImage] = useState(false)

  const [beforeImageUrl, setBeforeImageUrl] = useState('')
  const [beforeImageBase64, setBeforeImageBase64] = useState<string | null>(null)
  const [afterImageUrl, setAfterImageUrl] = useState('')
  const [processingComplete, setProcessingComplete] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }, [])

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
    setProcessingError(null)
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      if (!result) return
      const base64 = result.includes(',') ? result.split(',')[1] : undefined
      if (!base64) {
        setProcessingError('Unable to read that image. Please try a different file.')
        return
      }
      setBeforeImageBase64(base64)
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      const objectUrl = URL.createObjectURL(file)
      previewUrlRef.current = objectUrl
      setBeforeImageUrl(objectUrl)
      setHasBeforeImage(true)
      setProcessingError(null)
      setAfterImageUrl('')
      setProcessingProgress(0)
      event.target.value = ''
    }
    reader.onerror = () => {
      setProcessingError('We could not read that image. Please try again.')
    }
    reader.readAsDataURL(file)
  }

  const generateVisualization = async () => {
    if (!promptText.trim()) return
    if (!beforeImageBase64) {
      setProcessingError('Upload a photo before generating a transformation.')
      return
    }

    setProcessingError(null)
    setIsProcessing(true)
    setProcessingProgress(12)

    let interval: number | null = null
    interval = window.setInterval(() => {
      setProcessingProgress((prev) => (prev >= 90 ? prev : prev + 5))
    }, 300)

    try {
      const response = await api.post(
        '/ai/tools/execute',
        {
          name: 'image.edit',
          require_approval: false,
          params: {
            inputImageBase64: beforeImageBase64,
            prompt: promptText.trim(),
            preserveDims: true,
          },
        },
        { timeoutMs: 120000 },
      )

      if (!response || response.status !== 'ok') {
        const detail = String(response?.detail || response?.message || 'Unable to generate the visualization.')
        throw new Error(detail)
      }

      const generatedAfterImageUrl = response.data_url || response.preview_url
      if (!generatedAfterImageUrl) {
        throw new Error('The AI did not return an image. Please try again.')
      }

      setAfterImageUrl(generatedAfterImageUrl)
      setProcessingProgress(100)
      setProcessingComplete(true)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setProcessingError(detail)
      setProcessingComplete(false)
      setAfterImageUrl('')
    } finally {
      if (interval) {
        window.clearInterval(interval)
      }
      setIsProcessing(false)
    }
  }

  const resetConsultation = () => {
    setHasBeforeImage(false)
    setPromptText('')
    setProcessingProgress(0)
    setBeforeImageUrl('')
     setBeforeImageBase64(null)
    setAfterImageUrl('')
    setProcessingComplete(false)
    setProcessingError(null)
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
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
              disabled={isProcessing}
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
                  {beforeImageUrl ? (
                    <ImageWithFallback
                      src={beforeImageUrl}
                      alt="Client before photo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      Upload a photo to begin
                    </div>
                  )}
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
                      disabled={isProcessing || !beforeImageBase64}
                      size="lg"
                    >
                      {isProcessing ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          AI Processing…
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Sparkles className="h-5 w-5" />
                          Generate Transformation
                        </span>
                      )}
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
                {processingError && (
                  <div className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2">
                    {processingError}
                  </div>
                )}
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
