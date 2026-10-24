const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: apiKey });

const PROMPT_VALIDACAO = `
Analise este comprovante de pagamento Pix e verifique:
1. O comprovante é autêntico e confirma transferência Pix realizada?
2. O recebedor é "Pedro Henrique Corrêa da Silva"?
3. Extraia o valor exato pago e o nome do pagador.

Responda ESTRITAMENTE em formato JSON puro (sem markdown, sem \`\`\`json):
{
  "valido": true ou false,
  "recebedorCorreto": true ou false,
  "valor": 0.00,
  "pagador": "Nome do Pagador",
  "motivo": "Explicação se for inválido"
}
`;

app.post('/api/validar-pix', upload.single('comprovante'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo enviado.' });
    }

    console.log('[IA] Enviando comprovante para análise com gemini-1.5-flash...');

    const base64Data = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mimeType, data: base64Data } },
            { text: PROMPT_VALIDACAO }
          ]
        }
      ]
    });

    if (!response || !response.text) {
      throw new Error("A IA não retornou nenhuma resposta.");
    }

    console.log('[IA] Resposta recebida da Google com sucesso!');
    let textoResposta = response.text;
    textoResposta = textoResposta.replace(/```json/g, '').replace(/```/g, '').trim();
    const dadosAnalise = JSON.parse(textoResposta);

    if (dadosAnalise.valido && dadosAnalise.recebedorCorreto) {
      return res.json({
        sucesso: true,
        mensagem: 'Pix confirmado com sucesso!',
        dados: dadosAnalise
      });
    } else {
      return res.status(400).json({
        sucesso: false,
        erro: dadosAnalise.motivo || 'Comprovante inválido ou recebedor incorreto.',
        dados: dadosAnalise
      });
    }

  } catch (erro) {
    console.error('Erro no servidor:', erro.message);
    return res.status(500).json({
      sucesso: false,
      erro: erro.message || 'Erro ao processar imagem.'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

module.exports = app;
