import { ZonEncoder } from '../encoder';
import { ZonDecoder } from '../decoder';

describe('Metadata Optimization', () => {
  let encoder: ZonEncoder;
  let decoder: ZonDecoder;

  beforeEach(() => {
    encoder = new ZonEncoder();
    decoder = new ZonDecoder();
  });

  it('should encode nested metadata as grouped objects', () => {
    const data = {
      context: {
        task: "Our favorite hikes together",
        location: "Boulder",
        season: "spring_2025"
      },
      friends: ["ana", "luis", "sam"],
      hikes: [
        { id: 1, name: "Blue Lake Trail" }
      ]
    };

    const encoded = encoder.encode(data);
    
    // Should contain grouped context
    // context{location:Boulder,season:spring_2025,task:Our favorite hikes together}
    // Note: keys are sorted alphabetically. No colon after key for objects.
    expect(encoded).toContain('context{location:Boulder,season:spring_2025,task:Our favorite hikes together}');
    
    // Should NOT contain flattened keys
    expect(encoded).not.toContain('context.location:Boulder');
    expect(encoded).not.toContain('context.season:spring_2025');

    // Should still handle arrays correctly
    expect(encoded).toContain('friends[ana,luis,sam]');

    // Verify round-trip
    const decoded = decoder.decode(encoded);
    expect(decoded).toEqual(data);
  });

  it('should handle mixed primitive and nested metadata', () => {
    const data = {
      version: "1.0",
      config: { debug: true, retries: 3 }
    };

    const encoded = encoder.encode(data);
    
    // "1.0" should be quoted to preserve string type
    expect(encoded).toContain('version:"1.0"');
    expect(encoded).toContain('config{debug:T,retries:3}');
    
    const decoded = decoder.decode(encoded);
    expect(decoded).toEqual(data);
  });
});
