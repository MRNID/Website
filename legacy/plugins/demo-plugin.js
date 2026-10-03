function registerPlugins(app) {
  app.get('/api/plugins/demo', (req, res) => {
    res.json({
      success: true,
      plugin: 'demo-plugin',
      message: 'Plugin loaded successfully.',
      features: ['tenant-aware configuration', 'custom module routing', 'hooks ready'],
    });
  });
}

module.exports = {
  registerPlugins,
};
