import { useState } from 'react'
import { Upload, Sparkles, Camera, Palette, Eye, RotateCcw, Zap, Download, Share2, Settings, Play, MessageSquare, Wand2 } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { ImageWithFallback } from './figma/ImageWithFallback'
import { BeforeAfterSlider } from './before-after-slider'

const styleCategories = {
  hair: {
    name: 'Hair Styling',
    icon: '💇‍♀️',
    options: [
      { id: 'bob', name: 'Classic Bob', description: 'Timeless and chic' },
      { id: 'layers', name: 'Layered Cut', description: 'Volume and movement' },
      { id: 'pixie', name: 'Pixie Cut', description: 'Bold and edgy' },
      { id: 'beach-waves', name: 'Beach Waves', description: 'Effortless elegance' },
      { id: 'updo', name: 'Elegant Updo', description: 'Special occasion ready' }
    ]
  },
  lashes: {
    name: 'Lash Extensions',
    icon: '👁️',
    options: [
      { id: 'natural', name: 'Natural Volume', description: 'Subtle enhancement' },
      { id: 'dramatic', name: 'Dramatic Glam', description: 'Bold statement' },
      { id: 'cat-eye', name: 'Cat Eye', description: 'Elongated beauty' },
      { id: 'wispy', name: 'Wispy Lashes', description: 'Delicate flutter' },
      { id: 'mega-volume', name: 'Mega Volume', description: 'Maximum impact' }
    ]
  },
  nails: {
    name: 'Nail Art',
    icon: '💅',
    options: [
      { id: 'french', name: 'French Manicure', description: 'Classic elegance' },
      { id: 'ombre', name: 'Ombre Gradient', description: 'Modern transition' },
      { id: 'geometric', name: 'Geometric Art', description: 'Contemporary design' },
      { id: 'minimalist', name: 'Minimalist', description: 'Clean and simple' },
      { id: 'chrome', name: 'Chrome Finish', description: 'Futuristic shine' }
    ]
  }
}

export function BrandVZNAltLayout() {
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [hasBeforeImage, setHasBeforeImage] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [beforeImageUrl, setBeforeImageUrl] = useState('')
  const [afterImageUrl, setAfterImageUrl] = useState('')
  const [useCustomPrompt, setUseCustomPrompt] = useState(false)

  const handleImageUpload = () => {
    setHasBeforeImage(true)
    setShowResults(false)
    setBeforeImageUrl("https://images.unsplash.com/photo-1600637070413-0798fafbb6c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYWtldXAlMjBhcnRpc3R8ZW58MXx8fHwxNzU4NjU0MTcxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral")
  }

  const generateVisualization = () => {
    if (!useCustomPrompt && !selectedStyle) return
    if (useCustomPrompt && !customPrompt.trim()) return
    
    setIsProcessing(true)
    setProcessingProgress(0)
    setShowResults(false)
    
    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsProcessing(false)
          setShowResults(true)
          setAfterImageUrl("https://images.unsplash.com/photo-1610207928705-0ecd72bd4b6e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWF1dHklMjBjb25zdWx0YXRpb24lMjBiZWZvcmUlMjBhZnRlcnxlbnwxfHx8fDE3NTg2NTQxNjV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral")
          return 100
        }
        return prev + 12
      })
    }, 250)
  }

  const resetConsultation = () => {
    setHasBeforeImage(false)
    setShowResults(false)
    setSelectedCategory('')
    setSelectedStyle('')
    setCustomPrompt('')
    setProcessingProgress(0)
    setBeforeImageUrl('')
    setAfterImageUrl('')
    setUseCustomPrompt(false)
  }

  return (
    <div className="space-y-6">
      {/* Compact Header */}
      <div className="flex items-center justify-between py-4 border-b border-border">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              BrandVZN Studio
            </h1>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              AI-Powered Beauty Consultation
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
            <Zap className="h-3 w-3 mr-1" />
            AI Enhanced
          </Badge>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Main Content - Horizontal Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        
        {/* Left Panel - Controls */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Quick Upload Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-lg" style={{ fontFamily: 'Playfair Display, serif' }}>
                <Camera className="h-5 w-5 mr-2 text-primary" />
                Upload Client Photo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!hasBeforeImage ? (
                <div 
                  className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center hover:border-primary/60 transition-all cursor-pointer bg-primary/5"
                  onClick={handleImageUpload}
                >
                  <Upload className="h-10 w-10 mx-auto text-primary mb-3" />
                  <p className="font-medium text-primary mb-1">Click to Upload</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG up to 10MB</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                    <ImageWithFallback 
                      src="https://images.unsplash.com/photo-1600637070413-0798fafbb6c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYWtldXAlMjBhcnRpc3R8ZW58MXx8fHwxNzU4NjU0MTcxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                      alt="Client photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={resetConsultation}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Change Photo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Style Selection */}
          {hasBeforeImage && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-lg" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <Palette className="h-5 w-5 mr-2 text-primary" />
                  Style Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Toggle between preset and custom */}
                <div className="flex bg-muted rounded-lg p-1">
                  <button
                    onClick={() => setUseCustomPrompt(false)}
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      !useCustomPrompt 
                        ? 'bg-white text-primary shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Palette className="h-3 w-3 mr-1 inline" />
                    Presets
                  </button>
                  <button
                    onClick={() => setUseCustomPrompt(true)}
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      useCustomPrompt 
                        ? 'bg-white text-primary shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <MessageSquare className="h-3 w-3 mr-1 inline" />
                    Custom
                  </button>
                </div>

                {!useCustomPrompt ? (
                  // Preset Selection
                  <div className="space-y-4">
                    {/* Category Selection */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Category</label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select beauty category" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(styleCategories).map(([key, category]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center space-x-2">
                                <span>{category.icon}</span>
                                <span>{category.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Style Selection */}
                    {selectedCategory && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Style</label>
                        <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a style" />
                          </SelectTrigger>
                          <SelectContent>
                            {styleCategories[selectedCategory as keyof typeof styleCategories]?.options.map((style) => (
                              <SelectItem key={style.id} value={style.id}>
                                <div>
                                  <p className="font-medium">{style.name}</p>
                                  <p className="text-xs text-muted-foreground">{style.description}</p>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ) : (
                  // Custom Prompt
                  <div className="space-y-3">
                    <Label htmlFor="custom-prompt-alt" className="text-sm font-medium">
                      Custom AI Request
                    </Label>
                    <Textarea
                      id="custom-prompt-alt"
                      placeholder="Describe exactly what you want to see... e.g., 'Bold red lipstick with winged eyeliner and voluminous lashes'"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="min-h-[80px] resize-none text-sm"
                    />
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <Wand2 className="h-3 w-3" />
                      <span>Be specific for best AI results</span>
                    </div>
                  </div>
                )}

                {/* Generate Button */}
                {((useCustomPrompt && customPrompt.trim()) || (!useCustomPrompt && selectedStyle)) && (
                  <Button 
                    className="w-full mt-4" 
                    onClick={generateVisualization}
                    disabled={isProcessing}
                    size="lg"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isProcessing ? 'AI Processing...' : 'Generate Preview'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Processing Status */}
          {isProcessing && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">AI Processing</span>
                    <span className="text-sm text-muted-foreground">{processingProgress}%</span>
                  </div>
                  <Progress value={processingProgress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">
                    {processingProgress < 30 && "Analyzing features..."}
                    {processingProgress >= 30 && processingProgress < 70 && "Applying transformation..."}
                    {processingProgress >= 70 && "Finalizing result..."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel - Results */}
        <div className="xl:col-span-3">
          
          {showResults ? (
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <div className="flex items-center text-primary">
                    <Eye className="h-5 w-5 mr-2" />
                    Before & After Comparison
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Interactive slider to compare the transformation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  
                  {/* Interactive Before/After Slider */}
                  <div className="aspect-square max-w-lg mx-auto">
                    <BeforeAfterSlider
                      beforeImage={beforeImageUrl}
                      afterImage={afterImageUrl}
                      beforeAlt="Original Photo"
                      afterAlt="AI Transformation"
                      className="w-full h-full"
                    />
                  </div>

                  {/* Results Summary */}
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h5 className="font-medium mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Transformation Details
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <p className="font-medium text-primary">Applied Style</p>
                        <p className="text-muted-foreground">
                          {useCustomPrompt 
                            ? 'Custom AI Request' 
                            : (selectedCategory && selectedStyle ? 
                                styleCategories[selectedCategory as keyof typeof styleCategories]?.options.find(s => s.id === selectedStyle)?.name 
                                : 'Custom Style'
                              )
                          }
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-primary">Processing Time</p>
                        <p className="text-muted-foreground">2.5 seconds</p>
                      </div>
                      <div>
                        <p className="font-medium text-primary">AI Confidence</p>
                        <p className="text-muted-foreground">96% accuracy</p>
                      </div>
                      <div>
                        <p className="font-medium text-primary">Category</p>
                        <p className="text-muted-foreground">
                          {useCustomPrompt 
                            ? 'Custom Request' 
                            : (selectedCategory ? styleCategories[selectedCategory as keyof typeof styleCategories]?.name : 'Beauty')
                          }
                        </p>
                      </div>
                    </div>
                    
                    {/* Show the actual prompt used */}
                    {useCustomPrompt && customPrompt && (
                      <div className="pt-3 border-t border-border/50">
                        <p className="font-medium text-primary text-xs mb-1">AI Prompt Used</p>
                        <p className="text-xs text-muted-foreground italic bg-background rounded p-2 border">
                          "{customPrompt}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-center space-x-3">
                    <Button variant="outline" onClick={resetConsultation}>
                      New Consultation
                    </Button>
                    <Button>
                      Save to Client Profile
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Welcome/Placeholder
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center h-full text-center space-y-6 py-12">
                
                {!hasBeforeImage ? (
                  <>
                    <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center mb-4">
                      <Camera className="h-12 w-12 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                        Start Your AI Consultation
                      </h3>
                      <p className="text-muted-foreground max-w-md">
                        Upload a client photo to see stunning before & after transformations with our advanced AI technology.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center mb-4">
                      <Palette className="h-12 w-12 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                        Choose Your Style
                      </h3>
                      <p className="text-muted-foreground max-w-md">
                        Select a beauty category and specific style to see how your client will look with the transformation.
                      </p>
                    </div>
                  </>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-8 pt-8">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">50+</div>
                    <div className="text-xs text-muted-foreground">Style Options</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">3s</div>
                    <div className="text-xs text-muted-foreground">Avg Processing</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">95%</div>
                    <div className="text-xs text-muted-foreground">Accuracy Rate</div>
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