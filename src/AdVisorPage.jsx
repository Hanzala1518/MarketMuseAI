import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Image, Sparkles, Palette, Wand2, CheckCircle, AlertCircle, Loader2, Zap, Target, Download, Eye, RefreshCw, Copy, Share2, Layers, Upload, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { executeWithTokens } from './utils/tokenService';
import { handleCampaignTaskCompletion } from './services/campaignService';
import AdbriefPopup from './AdbriefPopup';

function AdVisorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // campaignId can be string or number - keep as-is from state
  const campaignId = location.state?.campaignId;
  const [session, setSession] = useState(null);
  const [headline, setHeadline] = useState('');

  const [subHeading, setSubHeading] = useState('');
  const [pointers, setPointers] = useState('');
  const [cta, setCta] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [resolution, setResolution] = useState('square');
  const [personDetails, setPersonDetails] = useState('');
  const [specificRequirements, setSpecificRequirements] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [error, setError] = useState('');
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // Session management
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Image size should be less than 10MB');
        return;
      }
      
      setUploadedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const removeUploadedImage = () => {
    setUploadedImage(null);
    setUploadedImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!headline || !subHeading || !cta || !buttonText) {
      setError('Please fill in all required fields (Headline, SubHeading, CTA, Button Text)');
      return;
    }

    // Check if user is logged in
    if (!session || !session.user) {
      setError('Please log in to use AdVisor');
      navigate('/login');
      return;
    }

    console.log('🔍 Starting AdVisor for:', headline);
    console.log('📋 Campaign ID:', campaignId || 'Not part of campaign');

    setLoading(true);
    setError('');
    setImageUrl(null);
    setImageData(null);

    try {
      console.log('🚀 Starting AdVisor with token deduction...');
      
      // Execute with token deduction (200 tokens)
      const tokenResult = await executeWithTokens(
        session.user.id,
        'AdVisor',
        async () => {
          console.log('🚀 Sending ad generation request...');
          
          // Convert uploaded image to base64 if present
          let personImageBase64 = '';
          if (uploadedImage) {
            personImageBase64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
              };
              reader.onerror = reject;
              reader.readAsDataURL(uploadedImage);
            });
            console.log('📸 Person image converted to base64');
          }
          
          const requestBody = {
            variationCount: "1",
            headline: headline,
            subHeading: subHeading,
            pointers: pointers,
            cta: cta,
            buttonText: buttonText,
            email: "",
            personDetails: personDetails,
            otherRequirements: specificRequirements,
            resolution: resolution,
            personImage: personImageBase64
          };
          
          console.log('📤 Request body prepared');
          
          const response = await fetch('https://glowing-g79w8.crab.containers.automata.host/webhook/adsgraphic', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'image/png, image/jpeg, image/*, application/octet-stream, */*'
            },
            body: JSON.stringify(requestBody)
          });

          console.log(`📥 Response received: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
          }

          // Return the response for token service to handle
          return response;
        },
        { headline, subHeading, cta, buttonText, resolution }, // Request data
        1, // Token multiplier (fixed cost)
        `Ad Creative: ${headline}`, // Output summary
        campaignId // Campaign ID
      );

      // Check result
      if (!tokenResult.success) {
        setError(tokenResult.error);
        setLoading(false);
        return;
      }

      // Success - tokens deducted, now process the image response
      console.log(`✅ AdVisor completed! Tokens deducted: ${tokenResult.tokensDeducted}`);
      console.log(`💰 Remaining tokens: ${tokenResult.tokensRemaining}`);
      
      const response = tokenResult.data;
      const headers = {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        contentDisposition: response.headers.get('content-disposition')
      };
      
      console.log(`📋 Content-Type: ${headers.contentType || 'Not specified'}`);
      console.log(`📊 Content-Length: ${headers.contentLength ? (parseInt(headers.contentLength) / 1024).toFixed(2) + ' KB' : 'Unknown'}`);
      console.log('Response headers:', headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      // Check if response is JSON (n8n misconfiguration)
      const contentType = headers.contentType || '';
      let blob;

      if (contentType.includes('application/json')) {
        console.log('📦 Received JSON response - extracting image data...');
        const jsonResponse = await response.json();
        console.log('📋 Full JSON Response:', jsonResponse);
        console.log('📋 JSON Response Keys:', Object.keys(jsonResponse));
        console.log('📋 JSON Response Type:', typeof jsonResponse);
        
        // n8n sends base64 image in JSON format
        let base64Data = null;
        
        // Strategy 1: Check if response is a direct string (common in n8n)
        if (typeof jsonResponse === 'string') {
          base64Data = jsonResponse;
          console.log('✅ Response is direct base64 string');
        }
        // Strategy 2: Check for common field names
        else if (jsonResponse.data) {
          base64Data = jsonResponse.data;
          console.log('✅ Found base64 data in "data" field');
        } else if (jsonResponse.image) {
          base64Data = jsonResponse.image;
          console.log('✅ Found base64 data in "image" field');
        } else if (jsonResponse.base64) {
          base64Data = jsonResponse.base64;
          console.log('✅ Found base64 data in "base64" field');
        } else if (jsonResponse.file) {
          base64Data = jsonResponse.file;
          console.log('✅ Found base64 data in "file" field');
        } else if (jsonResponse.output) {
          base64Data = jsonResponse.output;
          console.log('✅ Found base64 data in "output" field');
        }
        // Strategy 3: Check nested structures (n8n sometimes nests data)
        else if (jsonResponse[0] && typeof jsonResponse[0] === 'object') {
          // Array of objects
          const firstItem = jsonResponse[0];
          console.log('📋 First array item:', firstItem);
          if (firstItem.data) base64Data = firstItem.data;
          else if (firstItem.image) base64Data = firstItem.image;
          else if (firstItem.binary) base64Data = firstItem.binary;
          else if (firstItem.json && firstItem.json.data) base64Data = firstItem.json.data;
          
          if (base64Data) console.log('✅ Found base64 in nested array structure');
        }
        // Strategy 4: Look for any string property that looks like base64
        else {
          // Search all properties for base64-like strings
          for (const [key, value] of Object.entries(jsonResponse)) {
            if (typeof value === 'string' && value.length > 100) {
              // Check if it looks like base64 (only contains base64 characters)
              if (/^[A-Za-z0-9+/=]+$/.test(value.substring(0, 100))) {
                base64Data = value;
                console.log(`✅ Found base64-like data in "${key}" field`);
                break;
              }
            }
          }
        }
        
        if (!base64Data) {
          console.error('❌ No base64 data found in response');
          console.log(`🔍 Response structure: ${JSON.stringify(jsonResponse).substring(0, 200)}...`);
          console.error('Full JSON response:', jsonResponse);
          throw new Error('No base64 image data found in JSON response. Check console for full response.');
        }
        
        console.log('📋 Base64 data type:', typeof base64Data);
        console.log('📋 Base64 data length:', base64Data ? base64Data.length : 0);
        console.log('📋 Base64 first 100 chars:', base64Data ? base64Data.substring(0, 100) : 'null');
        
        console.log('🔄 Converting base64 to image blob...');
        
        // Clean the base64 string (remove data:image/png;base64, prefix if present)
        let cleanBase64 = base64Data;
        if (typeof cleanBase64 === 'string') {
          // Remove whitespace and newlines
          cleanBase64 = cleanBase64.replace(/\s/g, '');
          
          if (cleanBase64.includes(',')) {
            cleanBase64 = cleanBase64.split(',')[1];
            console.log('🧹 Removed data URL prefix');
          }
          
          // Remove any potential quotes
          cleanBase64 = cleanBase64.replace(/['"]/g, '');
          
          console.log('📋 Cleaned base64 length:', cleanBase64.length);
          console.log('📋 Cleaned base64 first 50 chars:', cleanBase64.substring(0, 50));
          
          // Decode base64 to binary
          try {
            const binaryString = atob(cleanBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            blob = new Blob([bytes], { type: 'image/png' });
            console.log(`✅ Base64 decoded successfully: ${(blob.size / 1024).toFixed(2)} KB`);
          } catch (decodeError) {
            console.error(`❌ Base64 decode failed: ${decodeError.message}`);
            console.error('Decode error:', decodeError);
            console.error('Attempted to decode:', cleanBase64.substring(0, 100));
            throw new Error('Failed to decode base64 image data. Invalid base64 format.');
          }
        } else {
          console.error('❌ Base64 data is not a string');
          throw new Error('Invalid base64 data format');
        }
      } else {
        // Direct binary response
        console.log('🖼️ Receiving binary file...');
        blob = await response.blob();
      }
      
      const blobInfo = {
        type: blob.type,
        size: blob.size,
        sizeMB: (blob.size / 1024 / 1024).toFixed(2) + ' MB'
      };
      
      console.log(`✅ Binary file received: ${blobInfo.sizeMB} (${blob.size} bytes)`);
      console.log('Received blob:', blobInfo);

      // Verify blob is valid
      if (!blob || blob.size < 1000) {
        console.error('❌ Received empty or invalid file (< 1KB)!');
        throw new Error('Received empty/invalid image data. Check n8n "Respond to Webhook" node configuration.');
      }

      // Force MIME type to image/png since n8n sends file.png
      const pngBlob = new Blob([blob], { type: 'image/png' });
      
      // Create a URL for the image blob
      const url = URL.createObjectURL(pngBlob);
      console.log('🎨 Image URL created successfully');
      console.log('Created blob URL:', url);
      
      setImageUrl(url);
      setImageData({
        fileName: `ad-image-${Date.now()}.png`,
        mimeType: 'image/png',
        fileSize: blobInfo.sizeMB,
        blob: pngBlob
      });
      
      console.log('✨ Image loaded and ready to display!');

      // Handle campaign task completion if this is part of a campaign
      if (campaignId) {
        console.log('📁 This is part of campaign:', campaignId);
        console.log('📁 Log ID from tokenResult:', tokenResult.logId);
        
        if (!tokenResult.logId) {
          console.error('❌ No logId returned from tokenService!');
        } else {
          console.log('✅ LogId available, proceeding with campaign artifact save...');
          
          // Get agent ID from database
          const { data: agentData, error: agentError } = await supabase
            .from('agents')
            .select('id')
            .eq('name', 'AdVisor')
            .single();
          
          if (agentError) {
            console.error('❌ Error fetching agent ID:', agentError);
          } else if (!agentData) {
            console.error('❌ AdVisor agent not found in database');
          } else {
            const agentId = agentData.id;
            console.log('✅ Agent ID:', agentId);
            
            const outputSummary = `Ad Creative: ${headline}`;
            
            const campaignResult = await handleCampaignTaskCompletion(
              campaignId,
              agentId,
              'AdVisor',
              tokenResult.logId,
              { imageUrl: url, headline, subHeading, cta, buttonText },
              outputSummary
            );
            
            if (campaignResult.success) {
              console.log('✅ Campaign artifact saved successfully!');
              alert('✅ Results saved to campaign! You can run this agent again to create additional artifacts.');
            } else {
              console.error('❌ Failed to save campaign artifact:', campaignResult.error);
              alert('⚠️ Ad created but failed to save to campaign: ' + campaignResult.error);
            }
          }
        }
      } else {
        console.log('📝 Running as standalone agent (not part of campaign)');
      }
    } catch (err) {
      console.error('Error details:', err);
      console.error('Stack trace:', err.stack);
      setError(err.message || 'Image generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl || !imageData) return;
    
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = imageData.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyLink = () => {
    if (!imageUrl) return;
    navigator.clipboard.writeText(imageUrl);
    alert('Image link copied to clipboard!');
  };

  const handleSelectBrief = (briefData) => {
    // Auto-fill the form with selected brief data
    setHeadline(briefData.headline || '');
    setSubHeading(briefData.subHeading || '');
    setPointers(briefData.primaryText || '');
    setCta(briefData.callToAction || '');
    setButtonText(briefData.buttonText || '');
    
    // Show success message
    alert('✨ Brief applied successfully! Your ad form is now pre-filled.');
  };

  return (
    <div style={s.container}>
      <AdbriefPopup 
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        onSelectBrief={handleSelectBrief}
        userId={session?.user?.id}
      />
      
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => window.history.back()}>
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      {!imageUrl && (
        <div style={s.hero}>
          <div style={s.heroIcon}>
            <Palette size={40} />
          </div>
          <h1 style={s.title}>AdVisor AI</h1>
          <p style={s.subtitle}>Create stunning, on-brand ad images from text prompts</p>
          
          {/* Create Brief Button */}
          <button 
            style={s.createBriefBtn} 
            onClick={() => setIsPopupOpen(true)}
            disabled={!session?.user?.id}
          >
            <Sparkles size={18} style={{marginRight: '8px'}} />
            Create Brief with AI
          </button>
        </div>
      )}

      <div style={s.main}>
        {!imageUrl && !loading && (
          <div style={s.card}>
            <h2 style={{...s.h2, marginTop: 0}}>
              <Sparkles size={20} /> Ad Details
            </h2>
            
            {/* Image Upload Section */}
            <div style={s.uploadSection}>
              <h3 style={s.uploadTitle}>
                <Upload size={18} /> Upload Person Image (Optional)
              </h3>
              <p style={s.uploadSubtitle}>Add a human face to create personalized ad visuals</p>
              
              {!uploadedImagePreview ? (
                <label style={s.uploadBox}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                    style={s.fileInput}
                  />
                  <div style={s.uploadContent}>
                    <div style={s.uploadIcon}>
                      <Upload size={32} />
                    </div>
                    <div style={s.uploadText}>
                      <strong>Click to upload</strong> or drag and drop
                    </div>
                    <div style={s.uploadHint}>PNG, JPG, WEBP up to 10MB</div>
                  </div>
                </label>
              ) : (
                <div style={s.previewContainer}>
                  <img src={uploadedImagePreview} alt="Preview" style={s.previewImage} />
                  <button onClick={removeUploadedImage} style={s.removeBtn}>
                    <X size={16} /> Remove
                  </button>
                </div>
              )}
            </div>

            {/* Person Details Section - Only show if image is uploaded */}
            {uploadedImagePreview && (
              <>
                <div style={s.divider}></div>
                <div style={s.personDetailsSection}>
                  <h3 style={s.uploadTitle}>
                    <Target size={18} /> Person Details
                  </h3>
                  <p style={s.uploadSubtitle}>Tell us about the person in the image for better context</p>
                  <textarea
                    value={personDetails}
                    onChange={(e) => setPersonDetails(e.target.value)}
                    placeholder="e.g., CEO of tech startup, professional background, young entrepreneur, etc."
                    style={{...s.textarea, minHeight: '100px'}}
                    rows={3}
                  />
                </div>
              </>
            )}

            <div style={s.divider}></div>
            
            <div style={s.formGrid}>
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>📝</span> Headline *
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g., Stop Wasting Hours — Automate with AI Agents!"
                  style={s.input}
                />
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>💬</span> Sub-Heading *
                </label>
                <input
                  type="text"
                  value={subHeading}
                  onChange={(e) => setSubHeading(e.target.value)}
                  placeholder="e.g., Let AI Agents Do the Heavy Lifting!"
                  style={s.input}
                />
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>📌</span> Key Pointers (one per line)
                </label>
                <textarea
                  value={pointers}
                  onChange={(e) => setPointers(e.target.value)}
                  placeholder="fast&#10;affordable&#10;secure"
                  style={{...s.textarea, minHeight: '100px'}}
                  rows={3}
                />
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>🎯</span> Call-to-Action *
                </label>
                <input
                  type="text"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="e.g., Join the AI-First Revolution"
                  style={s.input}
                />
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>🔘</span> Button Text *
                </label>
                <input
                  type="text"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="e.g., Join Us!"
                  style={s.input}
                />
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>📐</span> Resolution
                </label>
                <select 
                  value={resolution} 
                  onChange={(e) => setResolution(e.target.value)}
                  style={s.select}
                >
                  <option value="square">Square (1:1)</option>
                  <option value="landscape">Landscape (16:9)</option>
                  <option value="portrait">Portrait (9:16)</option>
                </select>
              </div>
            </div>
            
            <div style={s.divider}></div>
            
            {/* Specific Requirements Section */}
            <div style={s.requirementsSection}>
              <h3 style={s.uploadTitle}>
                <Zap size={18} /> Specific Requirements (Optional)
              </h3>
              <p style={s.uploadSubtitle}>Add any specific instructions, style preferences, or additional details</p>
              <textarea
                value={specificRequirements}
                onChange={(e) => setSpecificRequirements(e.target.value)}
                placeholder="e.g., Use vibrant colors, include company logo, modern minimalist style, add social media icons, etc."
                style={{...s.textarea, minHeight: '120px'}}
                rows={4}
              />
            </div>
            
            <div style={s.hint}>💡 Fill in all required fields (*) to generate your ad image</div>
            {error && <div style={s.error}><AlertCircle size={16} /> {error}</div>}
            <button onClick={handleSubmit} style={s.btn}>
              <Sparkles size={18} /> Generate Ad Image
            </button>
          </div>
        )}

        {loading && (
          <div style={s.loading}>
            <div style={s.generationAnimation}>
              {/* Colorful rotating circles */}
              <div style={s.circle1}></div>
              <div style={s.circle2}></div>
              <div style={s.circle3}></div>
              <div style={s.circle4}></div>
              
              {/* Center icon */}
              <div style={s.centerIcon}>
                <Wand2 size={40} color="#fff" />
              </div>
              
              {/* Floating particles */}
              <div style={s.particle1}></div>
              <div style={s.particle2}></div>
              <div style={s.particle3}></div>
              <div style={s.particle4}></div>
              <div style={s.particle5}></div>
              <div style={s.particle6}></div>
            </div>
            
            <h2 style={s.loadTitle}>Creating Your Masterpiece...</h2>
            <p style={s.loadText}>🎨 Analyzing prompt • 🖼️ Generating visuals • ✨ Adding magic</p>
            <div style={s.progressBar}>
              <div style={s.progressFill}></div>
            </div>
          </div>
        )}

        {imageUrl && (
          <div style={s.results}>
            <div style={s.resultHeader}>
              <div>
                <h1 style={s.reportTitle}>Generated Ad Image</h1>
                <p style={s.reportSub}>"{headline}"</p>
              </div>
              <button onClick={() => { 
                setImageUrl(null); 
                setImageData(null);
                setHeadline(''); 
                setSubHeading(''); 
                setPointers(''); 
                setCta(''); 
                setButtonText('');
                setPersonDetails('');
                setSpecificRequirements('');
                setUploadedImage(null);
                setUploadedImagePreview(null);
              }} style={s.newBtn}>
                <RefreshCw size={16} /> New Image
              </button>
            </div>

            {/* Image Display Card */}
            <div style={s.imageCard}>
              <div style={s.imageContainer}>
                <img 
                  src={imageUrl} 
                  alt="Generated Ad" 
                  style={s.generatedImage}
                />
              </div>
              
              <div style={s.imageActions}>
                <button style={s.actionBtn} onClick={handleDownload}>
                  <Download size={16} /> Download
                </button>
                <button style={s.actionBtn} onClick={() => window.open(imageUrl, '_blank')}>
                  <Eye size={16} /> View Full
                </button>
                <button style={s.actionBtn} onClick={handleCopyLink}>
                  <Copy size={16} /> Copy Link
                </button>
                <button style={s.actionBtn} onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Generated Ad Image',
                      text: headline,
                      url: imageUrl
                    }).catch(console.error);
                  } else {
                    alert('Sharing not supported on this browser');
                  }
                }}>
                  <Share2 size={16} /> Share
                </button>
              </div>
            </div>

            {/* Image Details */}
            {imageData && (
              <div style={s.card}>
                <h2 style={s.h2}><Layers size={20} /> Image Details</h2>
                <div style={s.detailsGrid}>
                  <div style={s.detailItem}>
                    <span style={s.detailLabel}>File Name</span>
                    <strong style={s.detailValue}>{imageData.fileName}</strong>
                  </div>
                  <div style={s.detailItem}>
                    <span style={s.detailLabel}>File Size</span>
                    <strong style={s.detailValue}>{imageData.fileSize}</strong>
                  </div>
                  <div style={s.detailItem}>
                    <span style={s.detailLabel}>Format</span>
                    <strong style={s.detailValue}>{imageData.mimeType}</strong>
                  </div>
                  <div style={s.detailItem}>
                    <span style={s.detailLabel}>Resolution</span>
                    <strong style={s.detailValue}>{resolution}</strong>
                  </div>
                  <div style={s.detailItem}>
                    <span style={s.detailLabel}>Generated At</span>
                    <strong style={s.detailValue}>{new Date().toLocaleString()}</strong>
                  </div>
                  <div style={s.detailItem}>
                    <span style={s.detailLabel}>Status</span>
                    <strong style={{...s.detailValue, color: '#10b981'}}>✓ Ready</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Tips Section */}
            <div style={s.card}>
              <h2 style={s.h2}><Zap size={20} /> Pro Tips</h2>
              <div style={s.tipsGrid}>
                <div style={s.tipCard}>
                  <div style={{...s.tipIcon, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)'}}>
                    <Target size={20} color="#8b5cf6" />
                  </div>
                  <div style={s.tipContent}>
                    <div style={s.tipTitle}>Be Specific</div>
                    <div style={s.tipText}>Include colors, style, and mood for better results</div>
                  </div>
                </div>

                <div style={s.tipCard}>
                  <div style={{...s.tipIcon, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)'}}>
                    <Palette size={20} color="#10b981" />
                  </div>
                  <div style={s.tipContent}>
                    <div style={s.tipTitle}>Brand Consistency</div>
                    <div style={s.tipText}>Mention your brand colors and style guidelines</div>
                  </div>
                </div>

                <div style={s.tipCard}>
                  <div style={{...s.tipIcon, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)'}}>
                    <Sparkles size={20} color="#fbbf24" />
                  </div>
                  <div style={s.tipContent}>
                    <div style={s.tipTitle}>Iterate & Refine</div>
                    <div style={s.tipText}>Generate multiple versions to find the perfect one</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  backBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.2))', border: '1px solid rgba(139,92,246,0.3)', color: '#e2e8f0', padding: '0.75rem 1.5rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.3s', backdropFilter: 'blur(10px)' },
  hero: { textAlign: 'center', padding: '4rem 2rem' },
  heroIcon: { display: 'inline-flex', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.2))', borderRadius: '20px', marginBottom: '1.5rem', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', boxShadow: '0 8px 32px rgba(139,92,246,0.3)' },
  title: { fontSize: '3rem', fontWeight: '700', background: 'linear-gradient(135deg, #8b5cf6, #ec4899, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '1rem' },
  subtitle: { fontSize: '1.25rem', color: '#94a3b8', marginBottom: '2rem' },
  createBriefBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)', border: 'none', color: 'white', padding: '1rem 2rem', borderRadius: '14px', fontSize: '1.05rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)', marginTop: '1rem' },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '2rem' },
  card: { background: 'linear-gradient(135deg, rgba(139,92,246,0.05), rgba(236,72,153,0.05))', backdropFilter: 'blur(20px)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '24px', padding: '2.5rem', marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  
  // Upload Section Styles
  uploadSection: { marginBottom: '2rem' },
  uploadTitle: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '0.5rem' },
  uploadSubtitle: { fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem' },
  uploadBox: { display: 'block', width: '100%', padding: '3rem', background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,51,234,0.1))', border: '2px dashed rgba(139,92,246,0.4)', borderRadius: '20px', cursor: 'pointer', transition: 'all 0.3s', textAlign: 'center', position: 'relative', overflow: 'hidden' },
  fileInput: { display: 'none' },
  uploadContent: { position: 'relative', zIndex: 1 },
  uploadIcon: { display: 'inline-flex', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.2))', borderRadius: '50%', marginBottom: '1rem', color: '#8b5cf6' },
  uploadText: { fontSize: '1.1rem', color: '#e2e8f0', marginBottom: '0.5rem' },
  uploadHint: { fontSize: '0.875rem', color: '#94a3b8' },
  previewContainer: { position: 'relative', display: 'inline-block', borderRadius: '16px', overflow: 'hidden', border: '2px solid rgba(139,92,246,0.3)', background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.1))' },
  previewImage: { maxWidth: '300px', maxHeight: '300px', display: 'block', borderRadius: '16px' },
  removeBtn: { position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(239,68,68,0.9)', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', transition: 'all 0.3s', backdropFilter: 'blur(10px)' },
  divider: { height: '1px', background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.5), transparent)', margin: '2rem 0' },
  personDetailsSection: { marginBottom: '1rem' },
  requirementsSection: { marginBottom: '1rem' },
  
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1rem' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { fontSize: '0.95rem', fontWeight: '600', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  labelIcon: { fontSize: '1.1rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' },
  input: { width: '100%', padding: '1rem', background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,51,234,0.1))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', color: '#e2e8f0', fontSize: '1rem', boxSizing: 'border-box', transition: 'all 0.3s', fontFamily: 'inherit', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.1)' },
  select: { width: '100%', padding: '1rem', background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,51,234,0.1))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', color: '#e2e8f0', fontSize: '1rem', boxSizing: 'border-box', transition: 'all 0.3s', fontFamily: 'inherit', cursor: 'pointer', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.1)' },
  textarea: { width: '100%', padding: '1rem', background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,51,234,0.1))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', color: '#e2e8f0', fontSize: '1rem', marginBottom: '0.5rem', boxSizing: 'border-box', transition: 'all 0.3s', fontFamily: 'inherit', resize: 'vertical', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.1)' },
  hint: { fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem', fontStyle: 'italic' },
  error: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' },
  btn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', background: 'linear-gradient(135deg, #8b5cf6, #ec4899, #f59e0b)', border: 'none', color: 'white', padding: '1.25rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 8px 32px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' },
  loading: { textAlign: 'center', padding: '4rem 2rem' },
  generationAnimation: { position: 'relative', width: '250px', height: '250px', margin: '0 auto 2rem' },
  circle1: { position: 'absolute', width: '100%', height: '100%', border: '4px solid #8b5cf6', borderRadius: '50%', animation: 'rotateCircle 3s linear infinite', opacity: 0.6 },
  circle2: { position: 'absolute', width: '80%', height: '80%', top: '10%', left: '10%', border: '4px solid #ec4899', borderRadius: '50%', animation: 'rotateCircle 2.5s linear infinite reverse', opacity: 0.6 },
  circle3: { position: 'absolute', width: '60%', height: '60%', top: '20%', left: '20%', border: '4px solid #3b82f6', borderRadius: '50%', animation: 'rotateCircle 2s linear infinite', opacity: 0.6 },
  circle4: { position: 'absolute', width: '40%', height: '40%', top: '30%', left: '30%', border: '4px solid #fbbf24', borderRadius: '50%', animation: 'rotateCircle 1.5s linear infinite reverse', opacity: 0.6 },
  centerIcon: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', animation: 'pulse 2s ease-in-out infinite' },
  particle1: { position: 'absolute', width: '8px', height: '8px', background: '#8b5cf6', borderRadius: '50%', top: '10%', left: '50%', animation: 'float 3s ease-in-out infinite' },
  particle2: { position: 'absolute', width: '6px', height: '6px', background: '#ec4899', borderRadius: '50%', top: '30%', right: '10%', animation: 'float 2.5s ease-in-out infinite 0.5s' },
  particle3: { position: 'absolute', width: '10px', height: '10px', background: '#3b82f6', borderRadius: '50%', bottom: '20%', left: '15%', animation: 'float 3.5s ease-in-out infinite 1s' },
  particle4: { position: 'absolute', width: '7px', height: '7px', background: '#fbbf24', borderRadius: '50%', bottom: '30%', right: '20%', animation: 'float 2.8s ease-in-out infinite 1.5s' },
  particle5: { position: 'absolute', width: '9px', height: '9px', background: '#10b981', borderRadius: '50%', top: '50%', left: '5%', animation: 'float 3.2s ease-in-out infinite 0.8s' },
  particle6: { position: 'absolute', width: '6px', height: '6px', background: '#f59e0b', borderRadius: '50%', top: '60%', right: '8%', animation: 'float 2.7s ease-in-out infinite 1.2s' },
  loadTitle: { fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' },
  loadText: { fontSize: '1.1rem', color: '#94a3b8', marginBottom: '2rem' },
  progressBar: { width: '100%', maxWidth: '400px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', margin: '0 auto' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #3b82f6, #fbbf24)', backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite', borderRadius: '4px' },
  results: { animation: 'fadeIn 0.5s ease' },
  resultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
  reportTitle: { fontSize: '2.5rem', fontWeight: '700', background: 'linear-gradient(135deg, #8b5cf6, #ec4899, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' },
  reportSub: { fontSize: '1rem', color: '#94a3b8', fontStyle: 'italic' },
  newBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #8b5cf6, #ec4899, #f59e0b)', border: 'none', color: 'white', padding: '0.875rem 1.75rem', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s', boxShadow: '0 4px 16px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' },
  h2: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: '#e2e8f0' },
  imageCard: { background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,51,234,0.1))', backdropFilter: 'blur(20px)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '24px', padding: '2.5rem', marginBottom: '1.5rem', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  imageContainer: { width: '100%', background: 'linear-gradient(135deg, rgba(0,0,0,0.3), rgba(139,92,246,0.1))', borderRadius: '16px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(139,92,246,0.2)', boxShadow: 'inset 0 2px 16px rgba(0,0,0,0.3)' },
  generatedImage: { width: '100%', height: 'auto', display: 'block', borderRadius: '16px' },
  imagePlaceholder: { textAlign: 'center' },
  imageActions: { display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(147,51,234,0.2))', border: '1px solid rgba(139,92,246,0.3)', color: '#e2e8f0', padding: '0.75rem 1.5rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.3s', fontWeight: '500', backdropFilter: 'blur(10px)' },
  detailsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' },
  detailItem: { padding: '1.25rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.1))', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.2)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' },
  detailLabel: { display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' },
  detailValue: { fontSize: '1.1rem', color: '#e2e8f0', fontWeight: '600' },
  tipsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' },
  tipCard: { display: 'flex', gap: '1rem', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(251,191,36,0.05), rgba(236,72,153,0.05))', borderRadius: '16px', border: '1px solid rgba(251,191,36,0.2)', transition: 'all 0.3s', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' },
  tipIcon: { width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: '1rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '0.5rem' },
  tipText: { fontSize: '0.875rem', color: '#94a3b8', lineHeight: '1.5' },
};

const css = document.createElement('style');
css.textContent = `
  @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rotateCircle { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; } }
  @keyframes float { 0%, 100% { transform: translateY(0px); opacity: 0.6; } 50% { transform: translateY(-20px); opacity: 1; } }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
  
  input:focus, textarea:focus, select:focus { 
    outline: none; 
    border-color: #8b5cf6; 
    box-shadow: 0 0 0 3px rgba(139,92,246,0.2), 0 8px 24px rgba(139,92,246,0.15);
    transform: translateY(-2px);
  }
  
  button:hover { 
    transform: translateY(-2px); 
    box-shadow: 0 12px 48px rgba(139,92,246,0.6) !important; 
  }
  
  .actionBtn:hover { 
    background: linear-gradient(135deg, rgba(59,130,246,0.3), rgba(147,51,234,0.3)); 
    border-color: rgba(139,92,246,0.5);
    transform: translateY(-2px);
  }
  
  .tipCard:hover { 
    transform: translateY(-4px); 
    background: linear-gradient(135deg, rgba(251,191,36,0.1), rgba(236,72,153,0.1)); 
    box-shadow: 0 8px 32px rgba(251,191,36,0.2);
  }
  
  label[style*="uploadBox"]:hover {
    border-color: rgba(139,92,246,0.6);
    background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(147,51,234,0.15));
    transform: scale(1.01);
  }
  
  .backBtn:hover {
    background: linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3));
  }
  
  .removeBtn:hover {
    background: rgba(239,68,68,1);
    transform: scale(1.05);
  }
  
  .detailItem {
    position: relative;
    overflow: hidden;
  }
  
  .detailItem::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
    transition: left 0.5s;
  }
  
  .detailItem:hover::before {
    left: 100%;
  }
  
  .detailItem:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(16,185,129,0.2);
  }
`;
document.head.appendChild(css);

export default AdVisorPage;
