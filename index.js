import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();

const port = process.env.PORT || 3000;

// Inicializar el cliente de Gemini (busca automáticamente la variable GEMINI_API_KEY)
const ai = new GoogleGenAI();

// Configurar multer para almacenar la imagen temporalmente en memoria
const upload = multer({ storage: multer.memoryStorage() });

const allowedOrigins = [
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'http://localhost:8080',
  'http://localhost:8100',
  'http://localhost:50036', // flutter chrome
  'http://localhost:50037', // flutter chrome
  'http://192.168.1.134:8100',
  'https://192.168.1.134:8100',
  'https://franfolio.dev'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));


// Middleware para parsear JSON y URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Función auxiliar para convertir el buffer de multer al formato que espera Gemini
function bufferToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType
    },
  };
}

// Función de retry con exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelayMs = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Verificar si es un error 503 (UNAVAILABLE) o 429 (TOO_MANY_REQUESTS)
      const isRetryable = error.status === 'UNAVAILABLE' ||
        error.code === 503 ||
        error.code === 429;

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      console.log(`Reintentando en ${delayMs}ms (intento ${attempt + 1}/${maxRetries})...`);

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

// Función para validar que la estructura JSON sea correcta
function validarEstructuraFactura(datos) {
  const errores = [];

  // Validar estructura básica
  if (!datos || typeof datos !== 'object') {
    errores.push('La respuesta no es un objeto JSON');
    return { valido: false, errores };
  }

  // Verificar que NO sea un array de texto (error común)
  if (Array.isArray(datos.lineas_texto)) {
    errores.push('Estructura inválida: contiene "lineas_texto" en lugar de estructura JSON correcta');
    return { valido: false, errores };
  }

  // Validar propiedades principales
  if (!datos.comercio || typeof datos.comercio !== 'object') {
    errores.push('Falta o es inválida la propiedad "comercio"');
  }

  if (!datos.factura || typeof datos.factura !== 'object') {
    errores.push('Falta o es inválida la propiedad "factura"');
  }

  if (!Array.isArray(datos.lineas)) {
    errores.push('Falta o es inválida la propiedad "lineas" (debe ser array)');
  } else {
    // Validar estructura de cada línea
    for (let i = 0; i < datos.lineas.length; i++) {
      const linea = datos.lineas[i];
      if (typeof linea !== 'object' || !('cantidad' in linea) || !('importe' in linea)) {
        errores.push(`Línea ${i} no tiene estructura correcta (falta cantidad o importe)`);
      }
    }
  }

  if (!datos.totales || typeof datos.totales !== 'object') {
    errores.push('Falta o es inválida la propiedad "totales"');
  } else {
    if (!Array.isArray(datos.totales.desglose_iva)) {
      errores.push('Falta o es inválida la propiedad "totales.desglose_iva" (debe ser array)');
    }
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

app.get('/gemini/api', cors(corsOptions), (req, res) => {
  res.json({ message: 'API de análisis de imágenes con Gemini' });
});

app.get('/gemini/', cors(corsOptions), (req, res) => {
  res.json({ message: 'API posha de análisis de imágenes con Gemini' });
});

// // Endpoint POST para procesar la imagen
// app.post('/api/analizar-imagen', upload.single('imagen'), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: 'No se ha proporcionado ninguna imagen.' });
//     }

//     const imagePart = bufferToGenerativePart(req.file.buffer, req.file.mimetype);
//     const prompt = req.body.prompt || "Extrae y devuelve todo el texto que aparece en esta imagen.";

//     console.log('Prompt:', prompt);


//     console.log('Imagen recibida:', req.file.originalname);


//     // Llamada al modelo con retry automático
//     const response = await retryWithBackoff(async () => {
//       return await ai.models.generateContent({
//         model: 'gemini-3.6-flash', // gemini-2.0-flash
//         // model: 'gemini-3.8-flash', // gemini-2.0-flash
//         contents: [prompt, imagePart],
//         config: {
//           responseMimeType: "application/json",
//         },
//       });
//     });

//     console.log('Respuesta del modelo:', response);

//     res.json({
//       success: true,
//       texto: response.text
//     });

//   } catch (error) {
//     console.error('Error al procesar la imagen:', error);

//     // Manejo específico de errores
//     const errorResponse = {
//       error: 'Ocurrió un error al procesar la imagen con Gemini.',
//       details: error.message
//     };

//     if (error.status === 'UNAVAILABLE' || error.code === 503) {
//       errorResponse.error = 'El servicio de Gemini está temporalmente no disponible. Intenta de nuevo en unos momentos.';
//       return res.status(503).json(errorResponse);
//     }

//     if (error.code === 429) {
//       errorResponse.error = 'Demasiadas solicitudes. Por favor, intenta de nuevo más tarde.';
//       return res.status(429).json(errorResponse);
//     }

//     res.status(500).json(errorResponse);
//   }
// });

app.post('/gemini/api/analizar-imagen', cors(corsOptions), upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ninguna imagen.' });
    }

    const imagePart = bufferToGenerativePart(req.file.buffer, req.file.mimetype);

    // Prompt ALTAMENTE ESTRUCTURADO para forzar JSON válido
    const prompt = req.body.prompt || `INSTRUCCIÓN CRÍTICA: Devuelve ÚNICAMENTE un JSON válido. NO devuelvas texto, NO devuelvas explicaciones, NO devuelvas arrays de texto.

Analiza la imagen de factura y extrae EXACTAMENTE esta estructura JSON (rellena campos vacíos con "" o 0.0):

{
  "comercio": {
    "nombre": "",
    "cif": "",
    "direccion": "",
    "poblacion": "",
    "telefono": ""
  },
  "factura": {
    "fecha": "",
    "hora": "",
    "operacion": "",
    "numero_factura": ""
  },
  "lineas": [
    {
      "cantidad": 0.0,
      "precio_unitario": 0.0,
      "importe": 0.0,
      "peso_kg": 0.0
    }
  ],
  "totales": {
    "total_eur": 0.0,
    "metodo_pago": "",
    "desglose_iva": [
      {
        "porcentaje": 0,
        "base_imponible": 0.0,
        "cuota": 0.0
      }
    ]
  }
}

REGLAS OBLIGATORIAS:
1. NUNCA devuelvas arrays de texto tipo "lineas_texto"
2. Solo devuelves JSON válido. Nada de explicaciones.
3. Si falta información, usa "" para strings y 0.0 para números
4. El array "lineas" DEBE contener objetos con cantidad, precio_unitario, importe, peso_kg
5. El array "desglose_iva" DEBE contener objetos con porcentaje, base_imponible, cuota
6. No necesitas campo "precio_unitario" - si no aparece separado, usa 0.0`;

    // Llamada al modelo con retry automático
    const response = await retryWithBackoff(async () => {
      return await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [prompt, imagePart],
        config: {
          responseMimeType: "application/json",
        },
      });
    });

    // Validar y parsear el JSON
    let datosFactura;
    try {
      datosFactura = JSON.parse(response.text);
    } catch (e) {
      console.error('❌ Gemini devolvió texto inválido:', response.text.substring(0, 200));
      return res.status(400).json({
        success: false,
        error: 'Gemini devolvió formato inválido. Intenta de nuevo.',
        debug: response.text.substring(0, 200)
      });
    }

    // Validar estructura OBLIGATORIA
    const estructura_valida = validarEstructuraFactura(datosFactura);
    if (!estructura_valida.valido) {
      console.error('❌ Estructura inválida:', estructura_valida.errores);
      return res.status(400).json({
        success: false,
        error: 'La respuesta de Gemini no tiene la estructura correcta',
        errores: estructura_valida.errores,
        respuesta_recibida: datosFactura
      });
    }

    console.log('✅ Factura procesada correctamente');
    res.json({
      success: true,
      data: datosFactura
    });

  } catch (error) {
    console.error('Error al procesar la imagen:', error);

    const errorResponse = {
      error: 'Ocurrió un error al procesar la imagen con Gemini.',
      details: error.message
    };

    if (error.status === 'UNAVAILABLE' || error.code === 503) {
      errorResponse.error = 'El servicio de Gemini está temporalmente no disponible. Intenta de nuevo en unos momentos.';
      return res.status(503).json(errorResponse);
    }

    if (error.code === 429) {
      errorResponse.error = 'Demasiadas solicitudes. Por favor, intenta de nuevo más tarde.';
      return res.status(429).json(errorResponse);
    }

    res.status(500).json(errorResponse);
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
