import DOMPurify from "dompurify";
import { Briefcase, Building, Globe, Mail, Phone, User, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface ReadOnlyProfileInfoProps {
  name?: string;
  company?: string;
  title?: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  avatarUrl?: string;
}

export function ReadOnlyProfileInfo({
  name = "山田太郎",
  company = "サンプル株式会社",
  title = "エンジニア",
  description = "よろしくお願いします",
  email = "taro@example.com",
  phone = "090-1234-5678",
  website = "https://example.com",
  avatarUrl = "",
}: ReadOnlyProfileInfoProps) {
  const { toast } = useToast();

  // テキストをサニタイズ
  const sanitizeText = (text: string) => {
    return DOMPurify.sanitize(text, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  };

  // VCard生成関数
  const generateVCard = () => {
    const vcardLines = ["BEGIN:VCARD", "VERSION:3.0"];

    // 名前
    if (name) {
      vcardLines.push(`N:${name}`);
      vcardLines.push(`FN:${name}`);
    }

    // 会社・役職
    if (company) {
      vcardLines.push(`ORG:${company}`);
    }
    if (title) {
      vcardLines.push(`TITLE:${title}`);
    }

    // 連絡先情報
    if (email) {
      vcardLines.push(`EMAIL:${email}`);
    }
    if (phone) {
      const phoneClean = phone.replace(/[\s-]/g, "");
      vcardLines.push(`TEL;TYPE=CELL:${phoneClean}`);
    }
    if (website) {
      vcardLines.push(`URL:${website}`);
    }

    // 一言メッセージ
    if (description) {
      vcardLines.push(`NOTE:${description}`);
    }

    vcardLines.push("END:VCARD");

    const vcard = vcardLines.join("\n");

    // ダウンロード処理
    const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "contact"}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "成功",
      description: "連絡先をダウンロードしました",
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
      <div className="text-center">
        {/* アバター */}
        <div className="mb-6">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={sanitizeText(name)}
              className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-gray-100"
            />
          ) : (
            <div className="w-24 h-24 rounded-full mx-auto bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <User className="w-12 h-12 text-white" />
            </div>
          )}
        </div>

        {/* 名前 */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {sanitizeText(name)}
        </h1>

        {/* 会社・役職 */}
        <div className="mb-4">
          {company && (
            <div className="flex items-center justify-center gap-2 text-gray-600 mb-1">
              <Building className="w-4 h-4" />
              <span>{sanitizeText(company)}</span>
            </div>
          )}
          {title && (
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <Briefcase className="w-4 h-4" />
              <span>{sanitizeText(title)}</span>
            </div>
          )}
        </div>

        {/* 説明 */}
        {description && (
          <p className="text-gray-700 mb-6 leading-relaxed">
            {sanitizeText(description)}
          </p>
        )}

        {/* VCardダウンロードボタン */}
        <div className="mb-6">
          <Button
            onClick={generateVCard}
            variant="default"
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            連絡先を保存
          </Button>
        </div>

        {/* 連絡先情報 */}
        <div className="space-y-3">
          {email && (
            <div className="flex items-center justify-center gap-3 text-gray-600">
              <Mail className="w-4 h-4" />
              <a
                href={`mailto:${email}`}
                className="hover:text-blue-600 transition-colors"
              >
                {sanitizeText(email)}
              </a>
            </div>
          )}

          {phone && (
            <div className="flex items-center justify-center gap-3 text-gray-600">
              <Phone className="w-4 h-4" />
              <a
                href={`tel:${phone}`}
                className="hover:text-blue-600 transition-colors"
              >
                {sanitizeText(phone)}
              </a>
            </div>
          )}

          {website && (
            <div className="flex items-center justify-center gap-3 text-gray-600">
              <Globe className="w-4 h-4" />
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors"
              >
                {sanitizeText(website)}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
