// api/proxy.js
export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const incoming = await request.json();

    const { url, method = "GET", headers = {}, body = null } = incoming;

    if (!url) {
      return new Response(JSON.stringify({ error: "Missing 'url' field" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Create safe headers - filter out any problematic headers
    const safeHeaders = new Headers();
    for (const key in headers) {
      if (
        key.toLowerCase() !== "host" &&
        key.toLowerCase() !== "content-length" &&
        !key.toLowerCase().startsWith("cf-")
      ) {
        safeHeaders.set(key, headers[key]);
      }
    }

    // Add a reasonable User-Agent if not provided
    if (!safeHeaders.has("User-Agent")) {
      safeHeaders.set(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );
    }

    const fetchOptions = {
      method: method,
      headers: safeHeaders,
    };

    // Only add body for methods that support it
    if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();

    // Copy response headers back (filter out security headers)
    const outgoingHeaders = new Headers({
      "Content-Type": response.headers.get("Content-Type") || "text/plain",
      "Access-Control-Allow-Origin": "*",
    });

    // Copy other safe headers
    for (const [key, value] of response.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (!["set-cookie", "content-encoding"].includes(lowerKey)) {
        outgoingHeaders.set(key, value);
      }
    }

    return new Response(responseText, {
      status: response.status,
      headers: outgoingHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
