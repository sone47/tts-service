interface TokenInfo {
  endpoint: EndpointData | null
  token: string | null
  expiredAt: number | null
}

interface EndpointData {
  r: string
  t: string
}

export interface TTSOptions {
  text: string
  voice?: string
  rate?: number
  pitch?: number
  style?: string
  outputFormat?: string
}

export interface Voice {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  FriendlyName: string;
  LocalName: string;
}

interface VoiceRaw {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  FriendlyName?: string;
  LocalName: string;
  SampleRateHertz?: string;
  Status?: string;
}

const constants = {
  TRUSTED_CLIENT_TOKEN: '6A5AA1D4EAFF4E9FB37E23D68491D6F4',
  WSS_URL: 'ws://api.msedgeservices.com/tts/cognitiveservices/websocket/v1',
  VOICES_URL: 'https://api.msedgeservices.com/tts/cognitiveservices/voices/list',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
  VERSION_MS_GEC: '1-140.0.3485.14',
}

class EdgeTTSService {
  private static readonly TOKEN_REFRESH_BEFORE_EXPIRY = 5 * 60
  private static readonly MAX_CHUNK_SIZE = 2000
  private static readonly SECRET_KEY = 'oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw=='

  private tokenInfo: TokenInfo = {
    endpoint: null,
    token: null,
    expiredAt: null,
  }

  private uuid(): string {
    return crypto.randomUUID().replace(/-/g, '')
  }

  private dateFormat(): string {
    const formattedDate = new Date().toUTCString().replace(/GMT/, '').trim() + ' GMT'
    return formattedDate.toLowerCase()
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  private bytesToBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...Array.from(bytes)))
  }

  private async hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
    return new Uint8Array(signature)
  }

  private async sign(urlStr: string): Promise<string> {
    const url = urlStr.split('://')[1]
    const encodedUrl = encodeURIComponent(url)
    const uuidStr = this.uuid()
    const formattedDate = this.dateFormat()
    const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase()
    const decode = this.base64ToBytes(EdgeTTSService.SECRET_KEY)
    const signData = await this.hmacSha256(decode, bytesToSign)
    const signBase64 = this.bytesToBase64(signData)
    return `MSTranslatorAndroidApp::${signBase64}::${formattedDate}::${uuidStr}`
  }

  private async getEndpoint(): Promise<EndpointData> {
    const now = Date.now() / 1000

    const isTokenValid = this.tokenInfo.token
      && this.tokenInfo.expiredAt
      && now < this.tokenInfo.expiredAt - EdgeTTSService.TOKEN_REFRESH_BEFORE_EXPIRY

    if (isTokenValid) {
      const remainingMinutes = ((this.tokenInfo.expiredAt! - now) / 60).toFixed(1)
      console.log(`使用缓存的token，剩余 ${remainingMinutes} 分钟`)
      return this.tokenInfo.endpoint!
    }

    const endpointUrl = 'https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0'
    const clientId = crypto.randomUUID().replace(/-/g, '')

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Accept-Language': 'zh-Hans',
          'X-ClientVersion': '4.0.530a 5fe1dc6c',
          'X-UserId': '0f04d16a175c411e',
          'X-HomeGeographicRegion': 'zh-Hans-CN',
          'X-ClientTraceId': clientId,
          'X-MT-Signature': await this.sign(endpointUrl),
          'User-Agent': 'okhttp/4.5.0',
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': '0',
          'Accept-Encoding': 'gzip',
        },
      })

      if (!response.ok) {
        throw new Error(`获取 endpoint 失败: ${response.status}`)
      }

      const data = await response.json() as EndpointData
      const jwt = data.t.split('.')[1]
      const decodedJwt = JSON.parse(atob(jwt)) as { exp: number }

      this.tokenInfo = {
        endpoint: data,
        token: data.t,
        expiredAt: decodedJwt.exp,
      }

      const validityMinutes = ((decodedJwt.exp - now) / 60).toFixed(1)
      console.log(`获取新 token 成功，有效期 ${validityMinutes} 分钟`)
      return data
    } catch (error) {
      console.error('获取 endpoint 失败:', error)
      if (this.tokenInfo.token && this.tokenInfo.endpoint) {
        console.log('使用过期的缓存 token')
        return this.tokenInfo.endpoint
      }
      throw error
    }
  }

  private getSsml(
    text: string,
    voiceName: string,
    rate: number,
    pitch: number,
    style: string,
  ): string {
    return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN"> 
                <voice name="${voiceName}"> 
                    <mstts:express-as style="${style}" styledegree="1.0" role="default"> 
                        <prosody rate="${rate}%" pitch="${pitch}%" volume="50">${text}</prosody> 
                    </mstts:express-as> 
                </voice> 
            </speak>`
  }

  private async getAudioChunk(
    text: string,
    voiceName: string,
    rate: number,
    pitch: number,
    style: string,
    outputFormat: string,
  ): Promise<Blob> {
    const endpoint = await this.getEndpoint()
    const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': endpoint.t,
        'Content-Type': 'application/ssml+xml',
        'User-Agent': 'okhttp/4.5.0',
        'X-Microsoft-OutputFormat': outputFormat,
      },
      body: this.getSsml(text, voiceName, rate, pitch, style),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Edge TTS API error: ${response.status} ${errorText}`)
    }

    return response.blob()
  }

  private nowRFC1123(timeZone = 'UTC'): string {
    const now = new Date()

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone,
      timeZoneName: 'short',
    }

    return now.toLocaleString('en-US', options)
  }

  private parseRFC1123(rfcStr: string): Date {
    return new Date(rfcStr)
  }

  private async generateSecMsGec(trustedClientToken: string): Promise<string> {
    const now = this.nowRFC1123()

    const fixedDate = this.parseRFC1123(now)

    const ticks = Math.floor(fixedDate.getTime() / 1000) + 11644473600
    const rounded = ticks - (ticks % 300)
    const windowsTicks = rounded * 10_000_000

    const encoder = new TextEncoder()
    const data = encoder.encode(`${windowsTicks}${trustedClientToken}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)

    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  }

  public async generateVoice(options: TTSOptions): Promise<Blob> {
    const {
      text,
      voice = 'zh-CN-XiaoxiaoNeural',
      rate = 1.0,
      pitch = 1.0,
      style = 'general',
      outputFormat = 'audio-24khz-48kbitrate-mono-mp3',
    } = options

    try {
      const chunks: string[] = []

      for (let i = 0; i < text.length; i += EdgeTTSService.MAX_CHUNK_SIZE) {
        const chunk = text.slice(i, i + EdgeTTSService.MAX_CHUNK_SIZE)
        chunks.push(chunk)
      }

      const ratePercent = (rate - 1) * 100
      const pitchPercent = (pitch - 1) * 100

      const audioChunks = await Promise.all(
        chunks.map(chunk =>
          this.getAudioChunk(chunk, voice, ratePercent, pitchPercent, style, outputFormat),
        ),
      )

      return new Blob(audioChunks, { type: 'audio/mpeg' })
    } catch (error) {
      console.error('语音合成失败:', error)
      throw error
    }
  }

  async getVoices(): Promise<Voice[]> {
    const secMsGEC = await this.generateSecMsGec(
      constants.TRUSTED_CLIENT_TOKEN,
    )

    const url = `${constants.VOICES_URL}?Ocp-Apim-Subscription-Key=${constants.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=${constants.VERSION_MS_GEC}`

    const response = await fetch(url, {
      headers: {
        'User-Agent': constants.USER_AGENT,
      },
    })

    if (!response.ok) {
      throw new Error(`获取语音列表失败: ${response.status}`)
    }

    const data = await response.json() as VoiceRaw[]
    return data.map((voice): Voice => ({
      Name: voice.Name,
      ShortName: voice.ShortName,
      Gender: voice.Gender,
      Locale: voice.Locale,
      FriendlyName: voice.FriendlyName ?? voice.LocalName,
      LocalName: voice.LocalName,
    }))
  }
}

export const edgeTTSService = new EdgeTTSService()
