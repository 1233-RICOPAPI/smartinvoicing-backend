import { Injectable } from '@nestjs/common';
import * as forge from 'node-forge';

/**
 * Firma digital del XML según DIAN (XAdES-BES / enveloped).
 * Certificado .p12 (PKCS#12) con clave privada.
 */
@Injectable()
export class SignerService {
  /**
   * Firma un XML UBL con el certificado .p12.
   * @param xmlContent XML completo como string
   * @param p12Buffer Contenido del archivo .p12
   * @param password Contraseña del .p12
   * @returns XML con nodo Signature insertado (enveloped)
   */
  signXml(
    xmlContent: string,
    p12Buffer: Buffer,
    password: string,
  ): string {
    const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    const certBag = certBags[forge.pki.oids.certBag]?.[0];
    if (!keyBag?.key || !certBag?.cert) {
      throw new Error('No se encontró clave privada o certificado en el .p12');
    }
    const privateKey = keyBag.key as forge.pki.PrivateKey;
    const cert = certBag.cert as forge.pki.Certificate;

    return this.signXmlWithForge(xmlContent, privateKey, cert);
  }

  /**
   * Firma XML usando node-forge: genera digest del documento y firma con RSA-SHA384.
   * Inserción del nodo Signature se hace por sustitución de cadena (en producción usar xml-crypto o similar).
   */
  private signXmlWithForge(
    xmlContent: string,
    privateKey: forge.pki.PrivateKey,
    cert: forge.pki.Certificate,
  ): string {
    const md = forge.md.sha384.create();
    md.update(xmlContent, 'utf8');
    const digest = forge.util.encode64(md.digest().getBytes());
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const certB64 = forge.util.encode64(certDer);

    const sigInfo = [
      '<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">',
      '<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
      '<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha384"/>',
      '<Reference URI="">',
      '<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms>',
      '<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha384"/>',
      '<DigestValue>' + digest + '</DigestValue>',
      '</Reference>',
      '</SignedInfo>',
    ].join('');

    const md2 = forge.md.sha384.create();
    md2.update(sigInfo, 'utf8');
    const signature = (privateKey as { sign: (md: forge.md.MessageDigest) => string }).sign(md2);
    const signatureB64 = forge.util.encode64(signature);

    const signatureNode = [
      '<ext:UBLExtensions xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">',
      '<ext:UBLExtension>',
      '<ext:ExtensionContent>',
      '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">',
      '<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">',
      '<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
      '<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha384"/>',
      '<Reference URI="">',
      '<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms>',
      '<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha384"/>',
      '<DigestValue>' + digest + '</DigestValue>',
      '</Reference>',
      '</SignedInfo>',
      '<SignatureValue>' + signatureB64 + '</SignatureValue>',
      '<KeyInfo>',
      '<X509Data><X509Certificate>' + certB64 + '</X509Certificate></X509Data>',
      '</KeyInfo>',
      '</ds:Signature>',
      '</ext:ExtensionContent>',
      '</ext:UBLExtension>',
      '</ext:UBLExtensions>',
    ].join('');

    // Reemplazar el primer UBLExtensions vacío por el que contiene la firma
    const extMatch = xmlContent.match(/<ext:UBLExtensions[^>]*>[\s\S]*?<\/ext:UBLExtensions>/);
    const replaced = extMatch
      ? xmlContent.replace(extMatch[0], signatureNode)
      : xmlContent;
    return replaced;
  }
}
