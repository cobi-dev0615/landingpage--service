import { Resend } from 'resend'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Initialize Resend
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY não configurada nas variáveis de ambiente. Configure a variável RESEND_API_KEY no Vercel com sua chave da API do Resend.')
  }
  // Validate API key format (Resend keys start with 're_')
  if (!apiKey.startsWith('re_')) {
    console.warn('⚠️ RESEND_API_KEY não parece estar no formato correto. Chaves do Resend começam com "re_"')
  }
  return new Resend(apiKey)
}

/**
 * Send e-book email with PDF attachment using Resend
 */
export async function sendEbookEmail({ name, email, phone }) {
  try {
    // Google Drive download links
    const googleDriveLinks = [
      'https://drive.google.com/uc?export=download&id=1K_IQzf-bTelQ6X4Q0T5b1xtPTKIFi5A0',
      'https://drive.google.com/uc?export=download&id=1udm_3zcMyH8ZmXlWCaNV2HUxE7BJCU3K',
      'https://drive.google.com/uc?export=download&id=1VbrucKW2St2QQ5cnI3FvURXSeHgfyaL_'
    ]
    // Use the first link as primary download button
    const fileLink = googleDriveLinks[0]
    
    // Get domain for platform link (frontend)
    const domain = process.env.DOMAIN || 'https://www.bethmirage.com'
    
    // Download all 3 PDFs from Google Drive
    const pdfFilenames = [
      'Nas-Garras-de-Beth-Mirage.pdf',
      'Porque-Faco-Isso.pdf',
      'Documento-3.pdf'
    ]
    
    const attachments = []
    const downloadedIds = new Set() // Track downloaded IDs to prevent duplicates
    const fileSizes = new Set() // Track file sizes to prevent duplicate content
    
    console.log('📥 Downloading PDFs from Google Drive...')
    for (let i = 0; i < googleDriveLinks.length && attachments.length < 3; i++) {
      try {
        // Extract file ID from URL to check for duplicates
        const fileId = googleDriveLinks[i].match(/id=([^&]+)/)?.[1]
        if (downloadedIds.has(fileId)) {
          console.log(`⚠️ Skipping duplicate file ID: ${fileId}`)
          continue
        }
        
        const response = await fetch(googleDriveLinks[i])
        if (!response.ok) {
          console.error(`❌ Failed to fetch PDF ${i + 1}: ${response.status} ${response.statusText}`)
          continue
        }
        const arrayBuffer = await response.arrayBuffer()
        const pdfBuffer = Buffer.from(arrayBuffer)
        
        // Check if buffer is valid (not empty and looks like PDF)
        if (pdfBuffer.length === 0) {
          console.error(`❌ PDF ${i + 1} is empty`)
          continue
        }
        
        // Check for duplicate file size (same size might indicate duplicate content)
        if (fileSizes.has(pdfBuffer.length)) {
          console.warn(`⚠️ PDF ${i + 1} has same size as previous file, might be duplicate. Size: ${pdfBuffer.length} bytes`)
          // Still add it, but log the warning
        }
        
        // Verify it's a PDF by checking the header
        const header = pdfBuffer.toString('ascii', 0, 4)
        if (header !== '%PDF') {
          console.error(`❌ PDF ${i + 1} is not a valid PDF file`)
          continue
        }
        
        attachments.push({
          filename: pdfFilenames[i] || `Documento-${i + 1}.pdf`,
          content: pdfBuffer
        })
        
        downloadedIds.add(fileId)
        fileSizes.add(pdfBuffer.length)
        console.log(`✅ PDF ${i + 1} downloaded successfully: ${pdfFilenames[i]} (${pdfBuffer.length} bytes)`)
      } catch (fetchError) {
        console.error(`❌ Error downloading PDF ${i + 1}:`, fetchError.message)
        // Continue with other PDFs even if one fails
      }
    }
    
    // Ensure exactly 3 attachments
    if (attachments.length === 0) {
      throw new Error('Failed to download any PDFs from Google Drive')
    }
    
    if (attachments.length > 3) {
      console.warn(`⚠️ Warning: More than 3 PDFs downloaded (${attachments.length}), keeping only first 3`)
      attachments.splice(3)
    }
    
    if (attachments.length < 3) {
      console.warn(`⚠️ Warning: Expected 3 PDFs but downloaded ${attachments.length}`)
    }
    
    console.log(`✅ Successfully prepared ${attachments.length} PDF attachments`)
    
    // Platform link (if you have one, otherwise use contact email)
    const platformLink = process.env.PLATFORM_LINK || `${domain}`

    // Prepare email HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          h1 {
            color: #000000;
            font-size: 24px;
            margin-bottom: 20px;
          }
          p {
            color: #666;
            margin-bottom: 15px;
          }
          .button {
            display: inline-block;
            padding: 14px 28px;
            background-color: #2563eb;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            margin: 20px 0;
            font-weight: 600;
            font-size: 16px;
            transition: background-color 0.3s ease;
            box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
          }
          .button:hover {
            background-color: #1d4ed8;
            box-shadow: 0 4px 8px rgba(37, 99, 235, 0.4);
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #999;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Olá, ${name}!</h1>
          <p>Obrigado por se interessar pelo projeto Beth Mirage.</p>
          <p>Segue em anexo o e-book "<strong>Nas Garras de Beth Mirage</strong>" para download.</p>
          <p>Os documentos estão anexados a este email. Você também pode baixá-los diretamente através dos links abaixo:</p>
          <p style="text-align: center;">
            <a href="${googleDriveLinks[0]}" class="button" style="color: #ffffff !important; margin: 5px;">Baixar Documento 1</a>
            <a href="${googleDriveLinks[1]}" class="button" style="color: #ffffff !important; margin: 5px;">Baixar Documento 2</a>
            <a href="${googleDriveLinks[2]}" class="button" style="color: #ffffff !important; margin: 5px;">Baixar Documento 3</a>
          </p>
          <p>Esperamos que este conteúdo seja útil em sua jornada de conscientização sobre o vício em apostas.</p>
          <p>Se você precisar de apoio adicional, não hesite em nos contatar.</p>
          <div class="footer">
            <p>Beth Mirage - A Ilusão que Mata a Alma</p>
            <p>Este é um email automático. Por favor, não responda diretamente.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
Olá, ${name}!

Obrigado por se interessar pelo projeto Beth Mirage.

Segue em anexo o e-book "Nas Garras de Beth Mirage" para download.

Os documentos estão anexados a este email. Você também pode baixá-los diretamente através dos links:

Documento 1: ${googleDriveLinks[0]}
Documento 2: ${googleDriveLinks[1]}
Documento 3: ${googleDriveLinks[2]}

Esperamos que este conteúdo seja útil em sua jornada de conscientização sobre o vício em apostas.

Se você precisar de apoio adicional, não hesite em nos contatar.

---
Beth Mirage - A Ilusão que Mata a Alma
Este é um email automático. Por favor, não responda diretamente.
    `

    // Send email via Resend
    const resend = getResendClient()
    
    const { data, error } = await resend.emails.send({
      from: `${process.env.FROM_NAME || 'Beth Mirage'} <${process.env.FROM_EMAIL || 'noreply@bethmirage.com'}>`,
      to: [email],
      replyTo: process.env.REPLY_TO_EMAIL || 'contato@bethmirage.com',
      subject: 'Seu e-book: Nas Garras de Beth Mirage',
      html: htmlContent,
      text: textContent,
      attachments: attachments
    })

    if (error) {
      // Provide more helpful error messages
      if (error.statusCode === 401) {
        throw new Error(`Resend API authentication failed. Verifique se RESEND_API_KEY está configurada corretamente no Vercel. Erro: ${error.message}`)
      }
      throw new Error(`Resend API error (${error.statusCode}): ${error.message || JSON.stringify(error)}`)
    }

    console.log('✅ E-book email sent successfully:', data?.id)
    return data
  } catch (error) {
    console.error('❌ Error sending e-book email:', error)
    throw error
  }
}

/**
 * Send confirmation email for story submission
 */
export async function sendStoryConfirmation({ email, identificationType }) {
  try {
    const anonymityText = identificationType === 'anonymous' 
      ? 'Seu relato foi recebido de forma completamente anônima.'
      : identificationType === 'pseudonym'
      ? 'Seu relato foi recebido com pseudônimo.'
      : 'Obrigado por compartilhar seu relato conosco.'

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          h1 {
            color: #000000;
            font-size: 24px;
            margin-bottom: 20px;
          }
          p {
            color: #666;
            margin-bottom: 15px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #999;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Obrigado por compartilhar sua voz</h1>
          <p>${anonymityText}</p>
          <p>Seu relato é importante e ajuda outras pessoas a entenderem que não estão sozinhas nesta luta.</p>
          <p>Se você precisar de apoio adicional, não hesite em nos contatar.</p>
          <div class="footer">
            <p>Beth Mirage - A Ilusão que Mata a Alma</p>
            <p>Este é um email automático. Por favor, não responda diretamente.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
Obrigado por compartilhar sua voz

${anonymityText}

Seu relato é importante e ajuda outras pessoas a entenderem que não estão sozinhas nesta luta.

Se você precisar de apoio adicional, não hesite em nos contatar.

---
Beth Mirage - A Ilusão que Mata a Alma
Este é um email automático. Por favor, não responda diretamente.
    `

    // Send email via Resend
    const resend = getResendClient()
    
    const { data, error } = await resend.emails.send({
      from: `${process.env.FROM_NAME || 'Beth Mirage'} <${process.env.FROM_EMAIL || 'noreply@bethmirage.com.br'}>`,
      to: [email],
      replyTo: process.env.REPLY_TO_EMAIL || 'contato@bethmirage.com.br',
      subject: 'Recebemos seu relato - Beth Mirage',
      html: htmlContent,
      text: textContent
    })

    if (error) {
      // Provide more helpful error messages
      if (error.statusCode === 401) {
        throw new Error(`Resend API authentication failed. Verifique se RESEND_API_KEY está configurada corretamente no Vercel. Erro: ${error.message}`)
      }
      throw new Error(`Resend API error (${error.statusCode}): ${error.message || JSON.stringify(error)}`)
    }

    console.log('✅ Story confirmation email sent successfully:', data?.id)
    return data
  } catch (error) {
    console.error('❌ Error sending story confirmation email:', error)
    throw error
  }
}
