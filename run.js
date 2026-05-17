const path = require('path');

const version = '3.5.4';

module.exports = () =>
{
	const config =
	{
		daemon: true,
		cmd:
		{
			'Default': 'python facefusion.py run',
			'Default+Jobs': 'python facefusion.py run --ui-layouts default jobs',
			'Performance': 'python facefusion.py run --execution-thread-count 8 --video-memory-strategy tolerant',
			'Benchmark': 'python facefusion.py run --ui-layouts benchmark --execution-thread-count 8 --video-memory-strategy tolerant',
			'Webcam': 'python facefusion.py run --ui-layouts webcam'
		},
		run:
		[
			{
				method: 'local.set',
				params:
				{
					mode: '{{ input.mode || "Default" }}'
				}
			},
			{
				method: 'shell.run',
				params:
				{
					message: `git checkout --quiet tags/${version}`,
					path: 'facefusion'
				}
			},
			{
				method: 'shell.run',
				params:
				{
					message: '{{ self.cmd[local.mode] || self.cmd.Default }}',
					path: 'facefusion',
					conda:
					{
						path: path.resolve(__dirname, '.env')
					},
					on:
					[
						{
							event: '/(http:\/\/[0-9.:]+)/',
							done: true
						}
					]
				}
			},
			{
				method: 'local.set',
				params:
				{
					url: '{{ input.event[0] }}'
				}
			}
		]
	};

	return config;
};
