Prompt para enviar, junto con la imagen a analizar

"""Analiza la siguiente imagen de una factura y devuelve la información estrictamente en formato JSON válido (sin bloques de código markdown adicionales si es posible, o bien dentro de un bloque json estándar), siguiendo esta estructura de claves:
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
      "descripcion": "",
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
}"""