import vCardsJS from "vcards-js";
import { GET, POST } from "./route";
import { getDocs } from "firebase/firestore";

// NextResponseのモック
jest.mock("next/server", () => {
  class MockResponse {
    status: number;
    headers: {
      get: (key: string) => string | null;
      set: (key: string, value: string) => void;
      has: (key: string) => boolean;
      _data: Map<string, string>;
    };
    body: any;

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.body = body;
      this.status = init?.status || 200;

      const headersData = new Map<string, string>();
      this.headers = {
        _data: headersData,
        get: (key: string) => headersData.get(key.toLowerCase()) || null,
        set: (key: string, value: string) =>
          headersData.set(key.toLowerCase(), value),
        has: (key: string) => headersData.has(key.toLowerCase()),
      };

      if (init?.headers) {
        const h = init.headers;
        if (h instanceof Headers) {
          h.forEach((value, key) => this.headers.set(key, value));
        } else if (Array.isArray(h)) {
          h.forEach(([key, value]) => this.headers.set(key, value));
        } else if (typeof h === "object") {
          Object.entries(h).forEach(([key, value]) => {
            this.headers.set(key, value as string);
          });
        }
      }
    }

    json() {
      if (typeof this.body === "string") {
        return Promise.resolve(JSON.parse(this.body));
      }
      return Promise.resolve(this.body);
    }

    text() {
      if (typeof this.body === "string") return Promise.resolve(this.body);
      return Promise.resolve(String(this.body ?? ""));
    }
  }

  class NextResponse extends MockResponse {
    static json(body: any, init?: ResponseInit) {
      const response = new MockResponse(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
      return response;
    }
  }

  return {
    NextResponse,
    NextRequest: jest.fn(),
  };
});

// NextRequestのモック
class MockNextRequest {
  url: string;
  method: string;
  body: ReadableStream | null;
  headers: Headers;
  nextUrl: {
    searchParams: URLSearchParams;
  };
  cookies: any;
  geo: any;
  ip: any;
  page: any;
  ua: any;
  internals: any;
  cache: any;
  credentials: any;
  destination: any;
  integrity: any;
  keepalive: any;
  mode: any;
  redirect: any;
  referrer: any;
  referrerPolicy: any;
  signal: any;
  duplex: any;
  bodyUsed: boolean;
  bytes: any;

  constructor(url: string, options: any = {}) {
    this.url = url;
    this.method = options.method || "GET";
    this.headers = new Headers(options.headers || {});
    this.cookies = options.cookies || {};
    this.geo = options.geo || {};
    this.ip = options.ip || "127.0.0.1";
    this.page = options.page || {};
    this.ua = options.ua || "";
    this.internals = options.internals || {};
    this.cache = options.cache || "default";
    this.bodyUsed = false;
    this.bytes = options.bytes || null;
    this.credentials = options.credentials || "same-origin";
    this.destination = options.destination || "";
    this.integrity = options.integrity || "";
    this.keepalive = options.keepalive || false;
    this.mode = options.mode || "cors";
    this.redirect = options.redirect || "follow";
    this.referrer = options.referrer || "about:client";
    this.referrerPolicy = options.referrerPolicy || "";
    this.signal = options.signal || null;
    this.duplex = options.duplex || "half";

    const urlObj = new URL(url);
    this.nextUrl = {
      searchParams: urlObj.searchParams,
    };

    if (options.body) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(options.body));
          controller.close();
        },
      });
      this.body = stream;
    } else {
      this.body = null;
    }
  }

  async json() {
    if (this.body) {
      const reader = this.body.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      return JSON.parse(text);
    }
    return {};
  }

  async text() {
    if (this.body) {
      const reader = this.body.getReader();
      const { value } = await reader.read();
      return new TextDecoder().decode(value);
    }
    return "";
  }

  async arrayBuffer() {
    if (this.body) {
      const reader = this.body.getReader();
      const { value } = await reader.read();
      return value.buffer;
    }
    return new ArrayBuffer(0);
  }

  async blob() {
    return new Blob();
  }

  async formData() {
    return new FormData();
  }

  clone() {
    return new MockNextRequest(this.url, { method: this.method });
  }
}

// vCardsJSのモック
jest.mock("vcards-js", () => {
  return jest.fn(() => {
    const mockInstance = {
      firstName: "",
      lastName: "",
      organization: "",
      title: "",
      email: "",
      workPhone: "",
      cellPhone: "",
      url: "",
      note: "",
      version: "",
      workAddress: {
        street: "",
        city: "",
        stateProvince: "",
        postalCode: "",
        countryRegion: "",
      },
      socialUrls: {
        facebook: "",
        linkedIn: "",
        twitter: "",
        instagram: "",
      },
      photo: {
        embedFromString: jest.fn(),
      },
      getFormattedString: jest.fn(
        () => "BEGIN:VCARD\nVERSION:3.0\nN:Doe;John;;;\nFN:John Doe\nEND:VCARD",
      ),
    };

    // Make properties writable and reactive
    return new Proxy(mockInstance, {
      set(target: any, prop: string | symbol, value: any) {
        target[prop] = value;
        return true;
      },
      get(target: any, prop: string | symbol) {
        return target[prop];
      },
    });
  });
});

// rateLimitのモック
jest.mock("@/lib/rateLimit", () => ({
  standardRateLimit: jest.fn().mockResolvedValue(null),
}));

// firebase/firestoreのモック
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  collection: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

// fetchのモック
global.fetch = jest.fn();

describe("VCard API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/vcard", () => {
    function createPostRequest(data: Record<string, unknown>) {
      const req = new MockNextRequest("http://localhost:3000/api/vcard", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      req.json = jest.fn().mockResolvedValue(data);
      return req;
    }

    it("基本的なVCardを生成できる", async () => {
      const requestData = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        organization: "Example Corp",
        title: "Developer",
      };

      const request = createPostRequest(requestData);

      const response = await POST(request as any);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/vcard;charset=utf-8",
      );
      expect(response.headers.get("Content-Disposition")).toContain(
        'attachment; filename="John_Doe.vcf"',
      );

      const body = await response.text();
      expect(body).toContain("BEGIN:VCARD");
      expect(body).toContain("FN:John Doe");
    });

    it("完全なプロファイルデータでVCardを生成できる", async () => {
      const requestData = {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        organization: "Tech Inc",
        title: "CEO",
        workPhone: "03-1234-5678",
        cellPhone: "090-1234-5678",
        url: "https://example.com",
        workAddress: {
          street: "123 Main St",
          city: "Tokyo",
          stateProvince: "Tokyo",
          postalCode: "100-0001",
          countryRegion: "Japan",
        },
        socialUrls: {
          facebook: "https://facebook.com/jane",
          linkedIn: "https://linkedin.com/in/jane",
          twitter: "https://twitter.com/jane",
          instagram: "https://instagram.com/jane",
        },
        photo: "data:image/jpeg;base64,/9j/4AAQSkZJRg",
        note: "This is a test note",
      };

      const request = createPostRequest(requestData);

      const response = await POST(request as any);

      expect(response.status).toBe(200);

      const body = await response.text();
      expect(body).toContain("BEGIN:VCARD");
    });

    it("最小限のデータでもVCardを生成できる", async () => {
      const requestData = {};

      const request = createPostRequest(requestData);

      const response = await POST(request as any);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Disposition")).toContain(
        'attachment; filename="contact_card.vcf"',
      );
    });

    it("不正なJSONデータでエラーを返す", async () => {
      const request = new MockNextRequest("http://localhost:3000/api/vcard", {
        method: "POST",
        body: "invalid json",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to generate VCard");
    });

    it("vCard生成エラー時に500エラーを返す", async () => {
      (vCardsJS as jest.Mock).mockImplementationOnce(() => ({
        getFormattedString: jest.fn(() => {
          throw new Error("VCard generation error");
        }),
      }));

      const requestData = {
        firstName: "Test",
        lastName: "User",
      };

      const request = new MockNextRequest("http://localhost:3000/api/vcard", {
        method: "POST",
        body: JSON.stringify(requestData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to generate VCard");
    });
  });

  describe("GET /api/vcard", () => {
    it("usernameパラメータでプロファイルを取得してVCardを生成", async () => {
      const mockProfile = {
        name: "John Doe",
        email: "john@example.com",
        company: "Example Corp",
        position: "Developer",
        phone: "03-1234-5678",
        website: "https://example.com",
      };

      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => mockProfile }],
      });

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=johndoe",
        { method: "GET" },
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/vcard;charset=utf-8",
      );
      expect(response.headers.get("Content-Disposition")).toContain(
        'attachment; filename="johndoe.vcf"',
      );

      const body = await response.text();
      expect(body).toContain("FN:John Doe");
      expect(body).toContain("EMAIL:john@example.com");
      expect(body).toContain("ORG:Example Corp");
      expect(body).toContain("URL:https://example.com");
    });

    it("X(旧Twitter)のURLを正しく処理する", async () => {
      const mockProfile = {
        name: "Test User",
        website: "https://x.com/testuser",
      };

      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => mockProfile }],
      });

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=testuser",
        { method: "GET" },
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);

      const body = await response.text();
      expect(body).toContain("URL:https://x.com/testuser");
    });

    it("名前が複数の部分から成る場合の処理", async () => {
      const mockProfile = {
        name: "John Michael Doe Smith",
        email: "john@example.com",
      };

      // Mock Firestore getDocs to return profile data
      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => mockProfile,
          },
        ],
      });

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=johndoe",
        {
          method: "GET",
        },
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);

      const body = await response.text();
      expect(body).toContain("FN:John Michael Doe Smith");
      expect(body).toContain("N:Michael Doe Smith;John;;;");
    });

    it("必須フィールドが存在しない場合でも処理できる", async () => {
      const mockProfile = {};

      // Mock Firestore getDocs to return profile data
      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => mockProfile,
          },
        ],
      });

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=emptyuser",
        {
          method: "GET",
        },
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);

      const body = await response.text();
      expect(body).toContain("BEGIN:VCARD");
      expect(body).toContain("END:VCARD");
    });

    it("usernameパラメータがない場合400エラーを返す", async () => {
      const request = new MockNextRequest("http://localhost:3000/api/vcard", {
        method: "GET",
      });

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Username required");
    });

    it("プロファイルが見つからない場合404エラーを返す", async () => {
      // Mock Firestore getDocs to return empty result
      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=notfound",
        {
          method: "GET",
        },
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Profile not found");
    });

    it("プロファイルAPI呼び出しが失敗した場合500エラーを返す", async () => {
      // Mock Firestore getDocs to throw an error
      (getDocs as jest.Mock).mockRejectedValueOnce(
        new Error("Firestore Error"),
      );

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=error",
        {
          method: "GET",
        },
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to generate VCard");
    });

    it("vCard生成中にエラーが発生した場合500エラーを返す", async () => {
      (getDocs as jest.Mock).mockRejectedValueOnce(
        new Error("Firestore read error"),
      );

      const mockProfile = {
        name: "Test User",
        email: "test@example.com",
      };

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=erroruser",
        {
          method: "GET",
        },
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to generate VCard");
    });
  });
});
