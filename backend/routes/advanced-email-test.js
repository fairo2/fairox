// 🔍 ADVANCED EMAIL DIAGNOSTIC TOOL
// File: routes/advanced-email-test.js
// For debugging stubborn SMTP connection issues on Render

const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const net = require('net');
const dns = require('dns').promises;

// ============================================
// 1. CHECK DNS RESOLUTION
// ============================================

router.get('/dns-test', async (req, res) => {
    console.log('\n' + '='.repeat(70));
    console.log('🌐 DNS RESOLUTION TEST');
    console.log('='.repeat(70));

    try {
        const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
        console.log(`\nResolving: ${host}`);

        const addresses = await dns.resolve4(host);
        
        console.log(`✅ DNS Resolution successful`);
        console.log(`   Resolved IPs: ${addresses.join(', ')}`);

        res.json({
            success: true,
            host: host,
            resolvedIPs: addresses,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(`❌ DNS Resolution failed: ${error.message}`);
        
        res.status(500).json({
            success: false,
            error: error.message,
            help: 'Cannot resolve SMTP host - check EMAIL_HOST variable'
        });
    }
});

// ============================================
// 2. CHECK PORT CONNECTIVITY
// ============================================

router.get('/port-test/:port', async (req, res) => {
    console.log('\n' + '='.repeat(70));
    console.log('🔌 PORT CONNECTIVITY TEST');
    console.log('='.repeat(70));

    const port = parseInt(req.params.port) || 465;
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';

    console.log(`\nTesting connection to ${host}:${port}`);

    try {
        await new Promise((resolve, reject) => {
            const socket = net.createConnection({
                host: host,
                port: port,
                timeout: 5000
            });

            socket.on('connect', () => {
                console.log(`✅ Port ${port} is OPEN and responding`);
                socket.destroy();
                resolve();
            });

            socket.on('timeout', () => {
                console.error(`❌ Port ${port} timeout - no response`);
                socket.destroy();
                reject(new Error(`Connection timeout on port ${port}`));
            });

            socket.on('error', (error) => {
                console.error(`❌ Connection error: ${error.message}`);
                reject(error);
            });
        });

        res.json({
            success: true,
            message: `Port ${port} is accessible`,
            host: host,
            port: port,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`Error: ${error.message}`);
        
        res.status(500).json({
            success: false,
            error: error.message,
            host: host,
            port: port,
            help: `Port ${port} is blocked or SMTP server not responding. Try port 587 or 465.`
        });
    }
});

// ============================================
// 3. TEST BOTH PORTS (465 & 587)
// ============================================

router.get('/test-both-ports', async (req, res) => {
    console.log('\n' + '='.repeat(70));
    console.log('🔀 TESTING BOTH PORTS (465 & 587)');
    console.log('='.repeat(70));

    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const results = {};

    // Test port 465 (SSL)
    console.log(`\nTesting port 465 (SSL)...`);
    try {
        await new Promise((resolve, reject) => {
            const socket = net.createConnection({
                host: host,
                port: 465,
                timeout: 5000
            });

            socket.on('connect', () => {
                console.log(`✅ Port 465 (SSL): OPEN`);
                socket.destroy();
                results.port465 = { status: 'OPEN', protocol: 'SSL' };
                resolve();
            });

            socket.on('timeout', () => {
                console.log(`❌ Port 465 (SSL): TIMEOUT`);
                socket.destroy();
                results.port465 = { status: 'TIMEOUT', protocol: 'SSL' };
                reject();
            });

            socket.on('error', (error) => {
                console.log(`❌ Port 465 (SSL): ${error.code}`);
                results.port465 = { status: 'CLOSED', protocol: 'SSL', error: error.code };
                reject();
            });
        });
    } catch (e) {
        // Continue to next test
    }

    // Test port 587 (TLS)
    console.log(`\nTesting port 587 (TLS)...`);
    try {
        await new Promise((resolve, reject) => {
            const socket = net.createConnection({
                host: host,
                port: 587,
                timeout: 5000
            });

            socket.on('connect', () => {
                console.log(`✅ Port 587 (TLS): OPEN`);
                socket.destroy();
                results.port587 = { status: 'OPEN', protocol: 'TLS' };
                resolve();
            });

            socket.on('timeout', () => {
                console.log(`❌ Port 587 (TLS): TIMEOUT`);
                socket.destroy();
                results.port587 = { status: 'TIMEOUT', protocol: 'TLS' };
                reject();
            });

            socket.on('error', (error) => {
                console.log(`❌ Port 587 (TLS): ${error.code}`);
                results.port587 = { status: 'CLOSED', protocol: 'TLS', error: error.code };
                reject();
            });
        });
    } catch (e) {
        // Continue
    }

    console.log('\n' + '='.repeat(70));

    res.json({
        success: true,
        host: host,
        results: results,
        recommendation: 
            results.port465?.status === 'OPEN' ? 'Use port 465 (SSL)' :
            results.port587?.status === 'OPEN' ? 'Use port 587 (TLS)' :
            'Both ports blocked - contact Render support',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// 4. SMTP AUTH TEST (Advanced)
// ============================================

router.get('/smtp-auth-test', async (req, res) => {
    console.log('\n' + '='.repeat(70));
    console.log('🔐 SMTP AUTHENTICATION TEST');
    console.log('='.repeat(70));

    try {
        const port = parseInt(process.env.EMAIL_PORT) || 465;
        const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

        console.log(`\nAttempting SMTP connection...`);
        console.log(`  Host: ${process.env.EMAIL_HOST}`);
        console.log(`  Port: ${port}`);
        console.log(`  Secure: ${secure}`);
        console.log(`  User: ${process.env.EMAIL_USER}`);
        console.log(`  Pass: ${'*'.repeat((process.env.EMAIL_PASS || '').length)}`);

        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: port,
            secure: secure,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            connectionTimeout: 10000,
            socketTimeout: 10000,
            logger: true,
            debug: true
        });

        console.log(`\n⏳ Verifying connection...`);

        await new Promise((resolve, reject) => {
            transporter.verify((error, success) => {
                if (error) {
                    console.error(`\n❌ SMTP Verification failed:`);
                    console.error(`   Message: ${error.message}`);
                    console.error(`   Code: ${error.code}`);
                    console.error(`   Command: ${error.command || 'N/A'}`);
                    reject(error);
                } else {
                    console.log(`\n✅ SMTP Connection successful`);
                    resolve();
                }
            });
        });

        res.json({
            success: true,
            message: 'SMTP authentication verified',
            config: {
                host: process.env.EMAIL_HOST,
                port: port,
                secure: secure,
                user: process.env.EMAIL_USER
            }
        });

    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);

        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code,
            recommendations: [
                'Verify EMAIL_USER and EMAIL_PASS are correct',
                'Gmail users: Use 16-character App Password',
                'Check Gmail 2FA is enabled',
                'Check if "Less secure apps" is allowed (if applicable)'
            ]
        });
    }
});

// ============================================
// 5. FULL SYSTEM DIAGNOSTIC
// ============================================

router.get('/full-system-check', async (req, res) => {
    console.log('\n' + '='.repeat(70));
    console.log('📋 FULL SYSTEM DIAGNOSTIC');
    console.log('='.repeat(70));

    const report = {
        timestamp: new Date().toISOString(),
        environment: {},
        dns: {},
        ports: {},
        smtp: {},
        recommendations: []
    };

    // 1. Check environment
    console.log('\n[1/4] Checking environment variables...');
    report.environment = {
        EMAIL_HOST: process.env.EMAIL_HOST ? '✅ SET' : '❌ MISSING',
        EMAIL_PORT: process.env.EMAIL_PORT ? '✅ SET' : '❌ MISSING',
        EMAIL_USER: process.env.EMAIL_USER ? '✅ SET' : '❌ MISSING',
        EMAIL_PASS: process.env.EMAIL_PASS ? '✅ SET' : '❌ MISSING',
        EMAIL_FROM: process.env.EMAIL_FROM ? '✅ SET' : '❌ MISSING'
    };

    // 2. DNS test
    console.log('[2/4] Testing DNS resolution...');
    try {
        const addresses = await dns.resolve4(process.env.EMAIL_HOST || 'smtp.gmail.com');
        report.dns = {
            status: '✅ RESOLVED',
            host: process.env.EMAIL_HOST,
            ips: addresses
        };
    } catch (error) {
        report.dns = { status: '❌ FAILED', error: error.message };
        report.recommendations.push('Cannot resolve EMAIL_HOST - verify it is correct');
    }

    // 3. Port test
    console.log('[3/4] Testing port connectivity...');
    const port = parseInt(process.env.EMAIL_PORT) || 465;
    try {
        await new Promise((resolve, reject) => {
            const socket = net.createConnection({
                host: process.env.EMAIL_HOST,
                port: port,
                timeout: 5000
            });

            socket.on('connect', () => {
                report.ports[port] = '✅ OPEN';
                socket.destroy();
                resolve();
            });

            socket.on('timeout', () => {
                report.ports[port] = '❌ TIMEOUT';
                socket.destroy();
                reject(new Error('timeout'));
            });

            socket.on('error', (error) => {
                report.ports[port] = `❌ ${error.code}`;
                reject(error);
            });
        });
    } catch (e) {
        report.recommendations.push(`Port ${port} is blocked or unresponsive`);
        report.recommendations.push('Try alternative port or contact Render support');
    }

    // 4. SMTP test
    console.log('[4/4] Testing SMTP authentication...');
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: port,
            secure: process.env.EMAIL_SECURE === 'true' || port === 465,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            connectionTimeout: 10000,
            socketTimeout: 10000
        });

        await new Promise((resolve, reject) => {
            transporter.verify((error, success) => {
                if (error) {
                    report.smtp = {
                        status: '❌ FAILED',
                        error: error.message,
                        code: error.code
                    };
                    reject(error);
                } else {
                    report.smtp = { status: '✅ SUCCESS' };
                    resolve();
                }
            });
        });
    } catch (error) {
        report.recommendations.push(`SMTP error: ${error.message}`);
        report.recommendations.push('Verify EMAIL_USER and EMAIL_PASS credentials');
    }

    console.log('='.repeat(70) + '\n');

    res.json(report);
});

module.exports = router;