interface Env {
    /** Base URL of your self-hosted Jotify instance, e.g. https://zwq.me */
    JOTIFY_API_URL: string;
    /** Shared secret (CRON_TOKEN) to authenticate with Jotify API */
    CRON_TOKEN: string;
    /** The inbound mail domain, e.g. "zwq.me" */
    INBOUND_DOMAIN: string;
}

export default {
    /**
     * Cloudflare Email Worker for Jotify
     * 
     * 1. If recipient matches "jot_[random]@inboundDomain", forwards the raw MIME body
     *    directly to the self-hosted Jotify API endpoint /api/inbound/email.
     * 2. Otherwise, queries the self-hosted Jotify API /api/email/route to check for
     *    custom forwarding rules. If a rule exists, calls message.forward() to the destination.
     * 3. Rejects the email if no rule is found.
     */
    async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
        const to = message.to.toLowerCase().trim();
        const from = message.from.toLowerCase().trim();
        console.log(`[jotify-email-workers] Inbound email: from=${from} to=${to}`);

        const inboundDomain = env.INBOUND_DOMAIN.trim().toLowerCase();
        
        // 1. If it starts with "jot_", it's a random ingestion email address
        // Match format: jot_[12 chars random]@domain (or subdomain)
        // e.g. jot_abcdef123456@zwq.me or jot_abcdef123456@mail.zwq.me
        const randomEmailPattern = new RegExp(`^jot_[a-z0-9]{12}@(?:[a-z0-9-]+\\.)*${inboundDomain.replace(/\./g, '\\.')}$`, 'i');

        if (randomEmailPattern.test(to)) {
            console.log(`[jotify-email-workers] Match random inbound email, forwarding raw MIME to Jotify API...`);
            await forwardRawMimeToJotify(message, env);
            return;
        }

        // 2. Query Jotify API on the VPS to see if this matches any custom routing rules
        console.log(`[jotify-email-workers] Checking custom routing rules for ${to}...`);
        try {
            const queryUrl = `${env.JOTIFY_API_URL}/api/email/route?to=${encodeURIComponent(to)}`;
            const res = await fetch(queryUrl, {
                headers: {
                    'X-Cron-Token': env.CRON_TOKEN,
                }
            });

            if (res.ok) {
                const data = await res.json() as { forward: boolean; destination?: string };
                if (data.forward && data.destination) {
                    console.log(`[jotify-email-workers] Match custom rule! Forwarding to: ${data.destination}`);
                    await message.forward(data.destination);
                    return;
                }
            } else {
                console.error(`[jotify-email-workers] Jotify API returned status ${res.status}`);
            }
        } catch (err) {
            console.error(`[jotify-email-workers] Error checking routing rules from Jotify API:`, err);
        }

        // 3. If no rules match, reject the email
        console.warn(`[jotify-email-workers] No rule matched for ${to}, rejecting.`);
        message.setReject('Address not allowed');
    }
};

async function forwardRawMimeToJotify(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const rawEmail = await streamToArrayBuffer(message.raw, message.rawSize);
    
    const targetUrl = `${env.JOTIFY_API_URL}/api/inbound/email`;
    try {
        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
            body: rawEmail,
        });

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Jotify API returned ${res.status}: ${errBody}`);
        }

        console.log(`[jotify-email-workers] Inbound email successfully ingested by Jotify API.`);
    } catch (err) {
        console.error(`[jotify-email-workers] Failed to forward raw email to Jotify API:`, err);
        throw err; // Throwing error will cause Cloudflare to bounce/retry appropriately
    }
}

async function streamToArrayBuffer(stream: ReadableStream, size: number): Promise<ArrayBuffer> {
    const reader = stream.getReader();
    const result = new Uint8Array(size);
    let offset = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result.set(value, offset);
        offset += value.length;
    }

    return result.buffer;
}
