/***********************************************************************
 *	d:/Werk/src/csmash-0.3.8.new/conv/parts.h
 *	$Id$
 *
 *	Copyright by ESESoft.
 *
 *	Redistribution and use in source and binary forms, with or without
 *	modification, are permitted provided that the following conditions
 *	are met:
 *
 *	Redistributions of source code must retain the above copyright
 *	notice, this list of conditions and the following disclaimer.
 *
 *	Redistributions in binary form must reproduce the above copyright
 *	notice, this list of conditions and the following disclaimer
 *	in the documentation and/or other materials provided with the
 *	distribution.
 *
 *	The name of the author may not be used to endorse or promote
 *	products derived from this software without specific prior written
 *	permission.
 *
 *	THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS
 *	OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 *	ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 *	DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 *	DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *	GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 *	INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *	WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *	NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 *	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 ***********************************************************************/
#ifndef __wata_ESESoft_9465__parts_h__INCLUDED__
#define __wata_ESESoft_9465__parts_h__INCLUDED__
/***********************************************************************/
#include <algorithm>
#include <vector>

#include "float"
#include "matrix"
#include "affine"

/* __BEGIN__BEGIN__ */

vector4F Affine2Quaternion(affine4F aff);
affine4F Quaternion2Affine(vector4F v, vector4F p);

class edge {
public:
    short v0, v1;
    short p0, p1;
};

class color4b
{
public:
    typedef unsigned char element_t;
    typedef unsigned char byte;
    enum {
	element_size = 4,
    };
    byte r, g, b, a;
    inline color4b() {}
    inline color4b(byte i, byte a=255) : r(i), g(i), b(i), a(a) {}
    inline color4b(byte r, byte g, byte b, byte a=255) :
      r(r), g(g), b(b), a(a) {}

    byte* element_array() { return (byte*)this; }
    const byte* element_array() const { return (byte*)this; }

    void glBind() const { glColor4ubv((const GLubyte*)element_array()); }
};

class color4f
{
public:
    typedef unsigned char element_t;
    enum {
	element_size = 4,
    };

    float r, g, b, a;

    inline color4f() {}
    inline color4f(int i, int a=255) : r(i/255.0F), g(i/255.0F), b(i/255.0F), a(a/255.0F) {}
    inline color4f(int r, int g, int b, int a=255) :
      r(r/255.0F), g(g/255.0F), b(b/255.0F), a(a/255.0F) {}

    float* element_array() { return (float*)this; }
    const float* element_array() const { return (float*)this; }

    color4f& operator *=(float d) { r *= d; g *= d; b *= d; return *this; }
    void glBind() const { glColor4fv(element_array()); }
};

class colormap
{
public:
    typedef color4f color_t;
    enum {
	map_size = 256,
    };

    bool load(const char *file);
    void fill(const color_t& c) {
	std::fill(&map[0], &map[map_size], c);
    }
    inline color_t& operator [](int i) { return map[i]; }
    inline const color_t& operator [](int i) const { return map[i]; }

public:
    color_t map[map_size];
};

class polygon;

class polyhedron
{
public:
    int numPoints, numPolygons, numEdges;
    vector3F *points;
    vector3F *texcoord;
    short (*polygons)[4];
    unsigned char *cindex;
    vector3F (*normals)[4];
    vector3F *planeNormal;
    edge *edges;
    char *filename;
    GLuint texturename;
    colormap cmap;

    polyhedron(const char *filename);
    ~polyhedron();
    polyhedron& operator *=(const affine4F &m);	//normal vectors are destroyed

    inline int polsize(int i) const { return (0 > polygons[i][3]) ? 3 : 4; }
    polygon getPolygon(int i) const;

    void getNormal();

protected:
    void initColormap();
};

/// polygon access object
class polygon
{
    friend class polyhedron;
protected:
    inline polygon(const polyhedron& parent, int polynum)
      : p(parent), num(polynum) {
	size = (p.polygons[num][3] < 0) ? 3 : 4;
    }

public:
    inline int round(int idx) const { return (idx+size)%size; }
    inline int pround(int idx) const { return idx%size; }

    inline short ri(int idx) const { return p.polygons[num][idx]; }
    inline short i(int idx) const { return p.polygons[num][round(idx)]; }

    inline const vector3F& rv(int idx) const { return p.points[ri(idx)]; }
    inline const vector3F& v(int idx) const { return p.points[i(idx)]; }

    inline const vector3F& rst(int idx) const { return p.texcoord[ri(idx)]; }
    inline const vector3F& st(int idx) const { return p.texcoord[i(idx)]; }

    inline const vector3F& rn(int idx) const { return p.normals[num][idx]; }
    inline const vector3F& n(int idx) const { return p.normals[num][round(idx)]; }
    inline const vector3F& n(void) const { return p.planeNormal[num]; }

    inline const unsigned char c() const { return p.cindex[num]; }

    inline short getv(short vidx) const {
	for (int k = 0; size > k; ++k) if (vidx == ri(k)) return k;
	return -1;
    }
    inline short gete(const edge&e, int* way) const {
	return gete(e.v0, e.v1, way);
    }
    inline short gete(short v0, short v1, int* way) const {
	for (int k = 0; size > k; ++k) {
	    if (v0 == ri(k)) {
		if (v1 == ri(pround(k+1))) {
		    *way = +1;
		    return k;
		}
		else if (v1 == i(k-1)) {
		    *way = -1;
		    return k;
		}
	    }
	}
	return -1;
    }

    inline GLenum glBeginSize() const {
	return (3 == size) ? GL_TRIANGLES : GL_QUADS;
    }

public:
    const polyhedron& p;
    int num;
    int size;
};

inline polygon polyhedron::getPolygon(int i) const {
    return polygon(*this, i);
}

class affineanim {
public:
    int numFrames;
    affine4F *matrices;

    affineanim(int num);
    affineanim(const char *filename);
    ~affineanim();

    inline const affine4F& operator[](int i) const {
	return matrices[i];
    }
    inline affine4F& operator [](int i) {
	return matrices[i];
    }
};

class affinemotion {
public:
    polyhedron ref;
    affineanim anim;

    affinemotion(const char *ref, const char *anim);
    void write(const char *basename);
    inline bool valid() const {
	return  ref.numPoints > 0 && anim.numFrames > 0;
    }
};

class quaternionanim {
public:
    int numFrames;
    std::vector<vector4F> quaternions;
    vector3F origin;

    quaternionanim(int num);
    quaternionanim(const char *filename);
    ~quaternionanim();

    inline const vector4F& operator[](int i) const {
	return quaternions[i];
    }
    inline const vector4F operator[](float i) const {
	if ( i == (int)i ) {
	    return quaternions[(int)i];
	} else {
	    vector4F q1 = quaternions[(int)i];
	    vector4F q2 = quaternions[(int)i+1];
	    if ( q1[1]*q2[1]+q1[2]*q2[2]+q1[3]*q2[3] < 0 )
	        q2 = -q2;
	    return q1*(1-(i-(int)i)) + q2*(i-(int)i);
	}
    }
    inline vector4F& operator [](int i) {
	return quaternions[i];
    }
    inline vector4F operator[](float i) {
	if ( i == (int)i ) {
	    return quaternions[(int)i];
	} else {
	    vector4F q1 = quaternions[(int)i];
	    vector4F q2 = quaternions[(int)i+1];
	    if ( q1[1]*q2[1]+q1[2]*q2[2]+q1[3]*q2[3] < 0 )
	        q2 = -q2;
	    return q1*(1-(i-(int)i)) + q2*(i-(int)i);
	}
    }
};

class quaternionmotion {
public:
    polyhedron ref;
    quaternionanim anim;

    quaternionmotion(const char *ref, const char *anim);
    //void write(const char *basename);
    inline bool valid() const {
	return  ref.numPoints > 0 && anim.numFrames > 0;
    }
};

class partsmotion
{
public:
    static polyhedron **polyparts;
    static int numParts;

    affineanim *origin;
    quaternionanim **qanim;

    partsmotion(const char *basename);
    virtual ~partsmotion();

    static bool loadmodel(const char *basename);

    virtual bool render(int frame, vector3F diff);
    virtual bool render(double frame, vector3F diff);
    virtual bool renderWire(int frame, vector3F diff);
    virtual bool renderWire(double frame, vector3F diff);
    virtual bool renderArmOnly(double frame, vector3F diff);

private:
    void drawleg( float xdiff, float ydiff, float zdiff, bool isWireFrame );
    void legIK( vector3F hip, vector3F &knee, vector3F &heel, vector3F toe,
		float thighLength, float shinLength, float footSize,
		bool isWireFrame );
    void drawbody( vector3F neck, vector3F waist, bool isWireFrame );

    void renderparts( int partsNum, bool isWireFrame );

    vector3F light;
};

/* __END__END__ */

/***********************************************************************/
#endif
/***********************************************************************
 *	END OF parts.h
 ***********************************************************************/
