import { z } from 'zod'

export const ttsRequestSchema = z.object({
  text: z.string().min(1, '文本不能为空').max(10000, '文本长度不能超过 10000 字符'),
  lang: z.string().optional().default('zh-CN'),
  voice: z.string().optional().default('zh-CN-XiaoxiaoNeural'),
  rate: z.number().min(0.5).max(2.0).optional().default(1.0),
  pitch: z.number().min(0.5).max(2.0).optional().default(1.0),
  style: z.string().optional().default('general'),
  outputFormat: z.string().optional().default('audio-24khz-48kbitrate-mono-mp3'),
})

export const ttsVoicesRequestSchema = z.object({
  locale: z.string().optional(),
  gender: z.string().optional(),
})

export type TTSVoicesRequest = z.infer<typeof ttsVoicesRequestSchema>
export type TTSRequest = z.infer<typeof ttsRequestSchema>