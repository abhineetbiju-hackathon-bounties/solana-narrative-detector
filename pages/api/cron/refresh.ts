import type { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify cron secret (Vercel automatically adds this header)
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔄 Starting automated narrative refresh...');
    
    // Run data collection
    console.log('📊 Collecting data...');
    const { stdout: collectOut, stderr: collectErr } = await execAsync('npm run collect');
    console.log(collectOut);
    if (collectErr) console.error(collectErr);

    // Run analysis
    console.log('🧠 Analyzing data...');
    const { stdout: analyzeOut, stderr: analyzeErr } = await execAsync('npm run analyze');
    console.log(analyzeOut);
    if (analyzeErr) console.error(analyzeErr);

    console.log('✅ Refresh complete!');
    
    res.status(200).json({
      success: true,
      message: 'Narratives refreshed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Refresh failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
