# TTS Service 接口说明

基于 Microsoft Edge TTS 的文本转语音服务，支持多种语言和音色。

## 1. 获取音色列表

### 方法名

`getVoices`

### 功能说明

获取可用的语音列表，支持按语言区域和性别筛选。

### 请求参数

| 参数名 | 类型   | 必填 | 说明                                 | 示例                      |
| ------ | ------ | ---- | ------------------------------------ | ------------------------- |
| locale | string | 否   | 语言区域代码，用于筛选特定区域的语音 | `zh-CN`, `en-US`, `ja-JP` |
| gender | string | 否   | 性别筛选                             | `male`, `female`          |

### 返回结果

返回 `Voice[]` 数组，每个 Voice 对象包含：

| 字段         | 类型   | 说明                |
| ------------ | ------ | ------------------- |
| Name         | string | 完整语音名称        |
| ShortName    | string | 短语音名称          |
| Gender       | string | 性别（male/female） |
| Locale       | string | 语言区域代码        |
| FriendlyName | string | 友好显示名称        |
| LocalName    | string | 本地化名称          |

### 使用示例

```javascript
// 获取所有语音
const allVoices = await service.getVoices({});

// 获取中文语音
const chineseVoices = await service.getVoices({ locale: "zh-CN" });

// 获取英文女声
const englishFemaleVoices = await service.getVoices({
  locale: "en-US",
  gender: "female",
});
```

## 2. 生成音频

### 方法名

`generateVoice`

### 功能说明

将文本转换为语音音频文件。

### 请求参数

| 参数名       | 类型   | 必填 | 默认值                            | 说明             | 限制                                                                                                                        |
| ------------ | ------ | ---- | --------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| text         | string | 是   | -                                 | 要转换的文本内容 | 1-10000 字符                                                                                                                |
| lang         | string | 否   | `zh-CN`                           | 语言代码         | -                                                                                                                           |
| voice        | string | 否   | `zh-CN-XiaoxiaoNeural`            | 语音名称         | 参考语音列表                                                                                                                |
| rate         | number | 否   | `1.0`                             | 语速倍率         | 0.5-2.0                                                                                                                     |
| pitch        | number | 否   | `1.0`                             | 音调倍率         | 0.5-2.0                                                                                                                     |
| style        | string | 否   | `general`                         | 语音风格         | 参考 [Azure 语音合成标记](https://learn.microsoft.com/zh-cn/azure/ai-services/speech-service/speech-synthesis-markup-voice) |
| outputFormat | string | 否   | `audio-24khz-48kbitrate-mono-mp3` | 输出音频格式     | -                                                                                                                           |

### 参数说明

- **rate**: 1.0 为正常语速，0.5 为半速，2.0 为两倍速
- **pitch**: 1.0 为正常音调，小于 1.0 降低音调，大于 1.0 提高音调
- **style**: 语音风格，如 `general`（通用）、`cheerful`（开朗）、`sad`（悲伤）等，具体支持的风格因语音而异

### 返回结果

返回 `Blob` 对象，包含生成的音频数据。

### 使用示例

```javascript
// 基础用法
const audio = await service.generateVoice({
  text: "你好，这是一个语音合成示例。",
});

// 自定义参数
const audio = await service.generateVoice({
  text: "Hello, this is a text to speech example.",
  voice: "en-US-JennyNeural",
  rate: 1.2, // 1.2倍速
  pitch: 1.1, // 提高音调
  style: "cheerful",
  outputFormat: "audio-24khz-48kbitrate-mono-mp3",
});

// 慢速朗读
const audio = await service.generateVoice({
  text: "这是一段慢速朗读的文本。",
  rate: 0.8,
  pitch: 0.9,
});
```

## 错误处理

服务会抛出以下错误：

- 获取语音列表失败时抛出 `获取语音列表失败` 错误
- TTS 生成失败时抛出 `TTS 生成失败` 错误
- 参数验证失败时会抛出相应的验证错误信息

## 注意事项

1. 文本长度限制为 10000 字符，超长文本会自动分段处理（每段最多 2000 字符）
2. rate 和 pitch 的有效范围是 0.5-2.0
3. 不同的语音支持的 style 可能不同，请参考 Azure 官方文档
4. 服务使用 Microsoft Edge TTS API，请遵守相关使用条款
