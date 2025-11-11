import { WorkerEntrypoint } from 'cloudflare:workers';
import { edgeTTSService } from './utils/edgeTTS';
import { TTSRequest, TTSVoicesRequest, ttsRequestSchema, ttsVoicesRequestSchema } from './schemas/tts';

export default class extends WorkerEntrypoint {
  async fetch() {
    return new Response('ok')
  }

  async getVoices(options: TTSVoicesRequest) {
    try {
      const validatedOptions = ttsVoicesRequestSchema.parse(options)
      const { locale, gender } = validatedOptions
      let voices = await edgeTTSService.getVoices()
  
      if (locale) {
        voices = voices.filter(voice => voice.Locale.startsWith(locale!))
      }
  
      if (gender) {
        voices = voices.filter(voice => voice.Gender.toLowerCase() === gender.toLowerCase())
      }
  
      return voices
    } catch (error) {
      throw error instanceof Error ? error : new Error('获取语音列表失败')
    }
  }

  async generateVoice(options: TTSRequest) {
    try {
      const validatedOptions = ttsRequestSchema.parse(options)
      const { text, voice, rate, pitch, style, outputFormat } = validatedOptions

      const audioBlob = await edgeTTSService.generateVoice({
        text,
        voice,
        rate,
        pitch,
        style, // https://learn.microsoft.com/zh-cn/azure/ai-services/speech-service/speech-synthesis-markup-voice
        outputFormat,
      })

      return audioBlob
    } catch (error) {
      throw error instanceof Error ? error : new Error('TTS 生成失败')
    }
  }
}
