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
    // Get backend URL for PDF download link
    const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'https://landingpage-service.vercel.app'
    const fileLink = `${backendUrl}/media/ebook.pdf`
    
    // Get domain for platform link (frontend)
    const domain = process.env.DOMAIN || 'https://www.bethmirage.com'
    
    // Read PDF file
    // Try multiple paths for different environments (Vercel, local, etc.)
    // Priority: server directory first, then other locations
    const possiblePaths = [
      // Server directory (highest priority for backend)
      path.resolve(__dirname, '../media/ebook.pdf'),
      path.resolve(process.cwd(), 'media/ebook.pdf'),
      // Environment variable path
      process.env.EBOOK_PDF_PATH ? path.resolve(__dirname, '../', process.env.EBOOK_PDF_PATH) : null,
      // Other common locations
      path.resolve(process.cwd(), 'public/media/ebook.pdf'),
      path.resolve(__dirname, '../ebooks/nas-garras-de-beth-mirage.pdf'),
      path.resolve(__dirname, '../../media/ebook.pdf'),
      path.resolve(__dirname, '../../frontend/public/media/ebook.pdf'),
      path.resolve(__dirname, '../../frontend/media/ebook.pdf')
    ].filter(Boolean) // Remove null values
    
    let pdfPath = null
    let pdfBuffer = null
    
    // Try to read from filesystem first
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        pdfPath = possiblePath
        break
      }
    }
    
    // If found on filesystem, read it
    if (pdfPath) {
      pdfBuffer = fs.readFileSync(pdfPath)
    } else {
      // Fallback: fetch PDF from public URL (for Vercel serverless functions)
      console.log('PDF not found on filesystem, fetching from URL:', fileLink)
      try {
        const response = await fetch(fileLink)
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF from URL: ${response.status} ${response.statusText}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        pdfBuffer = Buffer.from(arrayBuffer)
        console.log('✅ PDF fetched successfully from URL')
      } catch (fetchError) {
        throw new Error(`PDF file not found on filesystem and could not fetch from URL (${fileLink}): ${fetchError.message}. Tried paths: ${possiblePaths.join(', ')}`)
      }
    }
    
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
            color: #ffffff;
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
          <p>Você também pode baixar o e-book diretamente através do link abaixo:</p>
          <p style="text-align: center;">
            <a href="${fileLink}" class="button">Baixar E-book</a>
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

Você também pode baixar o e-book diretamente através do link:
${fileLink}

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
      attachments: [
        {
          filename: 'Nas-Garras-de-Beth-Mirage.pdf',
          content: pdfBuffer
        }
      ]
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
