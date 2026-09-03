import 'package:flutter/material.dart';
import '../../models/festival_model.dart';
import '../../models/post_model.dart';
import '../../services/api_service.dart';
import '../../services/community_service.dart';
import '../../services/festival_service.dart';
import '../../utils/constants.dart';

/// 게시글 작성/수정 화면.
///
/// [post]가 있으면 수정, 없으면 작성이다.
/// 수정에서는 게시판을 바꿀 수 없다. 게시판마다 작성 권한과 축제 연결 정책이 달라
/// 이동을 허용하면 그 검증을 모두 다시 통과시켜야 하는데 실익보다 사고 위험이 크다. (서버도 동일)
class PostEditorScreen extends StatefulWidget {
  /// 수정할 글. null이면 새 글 작성.
  final PostModel? post;

  /// 작성 화면에서 미리 선택해 둘 게시판.
  final BoardCategoryModel? initialCategory;

  /// 축제 상세에서 "후기 쓰기"로 들어온 경우 고정할 축제.
  final int? fixedFestivalId;
  final String? fixedFestivalName;

  const PostEditorScreen({
    super.key,
    this.post,
    this.initialCategory,
    this.fixedFestivalId,
    this.fixedFestivalName,
  });

  @override
  State<PostEditorScreen> createState() => _PostEditorScreenState();
}

class _PostEditorScreenState extends State<PostEditorScreen> {
  final CommunityService _service = CommunityService();
  final FestivalService _festivalService = FestivalService();
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _titleController;
  late final TextEditingController _contentController;

  List<BoardCategoryModel> _categories = [];
  BoardCategoryModel? _selectedCategory;

  List<FestivalModel> _festivals = [];
  int? _selectedFestivalId;

  bool _isLoading = true;
  bool _isSubmitting = false;

  /// 수정 모드인지 여부.
  bool get _isEditing => widget.post != null;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.post?.title ?? '');
    _contentController = TextEditingController(text: widget.post?.content ?? '');
    _selectedFestivalId = widget.fixedFestivalId ?? widget.post?.festival?.id;
    _loadCategories();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  /// 게시판 목록을 불러온다.
  ///
  /// 서버가 게시판별 정책(운영자 전용, 축제 필수)을 함께 주므로
  /// 앱은 그 값만 보고 화면을 구성한다. 게시판 코드를 앱에 하드코딩하지 않는다.
  Future<void> _loadCategories() async {
    try {
      final categories = await _service.fetchCategories();
      if (!mounted) return;

      setState(() {
        // 공지사항처럼 운영자만 쓸 수 있는 게시판은 선택지에서 뺀다.
        // 서버가 403으로 막지만, 고를 수 있게 두면 쓰고 나서야 거절당한다.
        _categories = categories.where((category) => !category.isAdminOnly).toList();

        _selectedCategory = _resolveInitialCategory();
        _isLoading = false;
      });

      await _loadFestivalsIfNeeded();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showMessage(error.message);
    }
  }

  /// 처음 선택되어 있을 게시판을 정한다.
  BoardCategoryModel? _resolveInitialCategory() {
    final targetCode = widget.post?.category?.code ?? widget.initialCategory?.code;

    for (final category in _categories) {
      if (category.code == targetCode) return category;
    }

    // 축제에서 들어왔다면 후기 게시판이 가장 자연스러운 기본값이다.
    if (widget.fixedFestivalId != null) {
      for (final category in _categories) {
        if (category.requireFestival) return category;
      }
    }

    return _categories.isNotEmpty ? _categories.first : null;
  }

  /// 축제를 선택해야 하는 게시판이면 축제 목록을 불러온다.
  ///
  /// 축제 상세에서 들어온 경우에는 축제가 이미 정해져 있으므로 부르지 않는다.
  Future<void> _loadFestivalsIfNeeded() async {
    if (widget.fixedFestivalId != null) return;
    if (_selectedCategory?.requireFestival != true) return;
    if (_festivals.isNotEmpty) return;

    try {
      final festivals = await _festivalService.fetchFestivals(limit: 100);
      if (!mounted) return;
      setState(() => _festivals = festivals);
    } on ApiException catch (error) {
      if (!mounted) return;
      _showMessage(error.message);
    }
  }

  /// 글을 저장한다. (작성 또는 수정)
  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCategory == null) return;

    // 축제 필수 게시판인데 축제를 안 골랐으면 서버에 보내기 전에 막는다.
    if (_selectedCategory!.requireFestival && _selectedFestivalId == null) {
      _showMessage("'${_selectedCategory!.name}' 게시판은 축제를 선택해야 합니다.");
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      if (_isEditing) {
        await _service.updatePost(
          widget.post!.id,
          title: _titleController.text,
          content: _contentController.text,
        );
      } else {
        await _service.createPost(
          categoryCode: _selectedCategory!.code,
          title: _titleController.text,
          content: _contentController.text,
          festivalId: _selectedFestivalId,
        );
      }

      if (!mounted) return;
      // 목록/상세가 스스로 새로고침할 수 있도록 성공 여부를 돌려준다.
      Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (!mounted) return;
      _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? AppStrings.editPost : AppStrings.writePost),
        actions: [
          TextButton(
            onPressed: _isSubmitting ? null : _submit,
            child: Text(_isSubmitting ? '저장 중...' : AppStrings.saveButton),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(AppSizes.paddingMedium),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildCategoryField(),
                    const SizedBox(height: AppSizes.paddingMedium),
                    _buildFestivalField(),
                    TextFormField(
                      controller: _titleController,
                      maxLength: 200,
                      decoration: const InputDecoration(
                        labelText: AppStrings.postTitleLabel,
                        border: OutlineInputBorder(),
                      ),
                      // 서버와 같은 기준(2자 이상)으로 미리 막는다.
                      validator: (value) => (value ?? '').trim().length < 2
                          ? '제목은 2자 이상 입력해 주세요.'
                          : null,
                    ),
                    const SizedBox(height: AppSizes.paddingMedium),
                    TextFormField(
                      controller: _contentController,
                      maxLines: 12,
                      maxLength: 10000,
                      decoration: const InputDecoration(
                        labelText: AppStrings.postContentLabel,
                        alignLabelWithHint: true,
                        border: OutlineInputBorder(),
                      ),
                      validator: (value) =>
                          (value ?? '').trim().isEmpty ? '내용을 입력해 주세요.' : null,
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  /// 게시판 선택 칸. 수정 모드에서는 읽기 전용으로 보여준다.
  Widget _buildCategoryField() {
    if (_isEditing) {
      return InputDecorator(
        decoration: const InputDecoration(
          labelText: AppStrings.boardSection,
          border: OutlineInputBorder(),
        ),
        child: Text(widget.post?.category?.name ?? '-'),
      );
    }

    return DropdownButtonFormField<BoardCategoryModel>(
      initialValue: _selectedCategory,
      decoration: const InputDecoration(
        labelText: AppStrings.boardSection,
        border: OutlineInputBorder(),
      ),
      items: _categories
          .map((category) => DropdownMenuItem(value: category, child: Text(category.name)))
          .toList(),
      onChanged: (category) {
        setState(() {
          _selectedCategory = category;
          // 축제가 필요 없는 게시판으로 옮기면 선택했던 축제를 비운다.
          if (category?.requireFestival != true && widget.fixedFestivalId == null) {
            _selectedFestivalId = null;
          }
        });
        _loadFestivalsIfNeeded();
      },
    );
  }

  /// 축제 선택 칸.
  ///
  /// 축제 연결이 필요 없는 게시판에서는 아예 보여주지 않는다.
  Widget _buildFestivalField() {
    final needsFestival = _selectedCategory?.requireFestival == true;
    if (!needsFestival && widget.fixedFestivalId == null) return const SizedBox.shrink();

    // 축제 상세에서 들어왔으면 대상이 이미 정해져 있으므로 고르게 하지 않는다.
    if (widget.fixedFestivalId != null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: AppSizes.paddingMedium),
        child: InputDecorator(
          decoration: const InputDecoration(
            labelText: AppStrings.selectFestival,
            border: OutlineInputBorder(),
          ),
          child: Text(widget.fixedFestivalName ?? '선택된 축제'),
        ),
      );
    }

    // 수정 모드에서는 축제를 바꾸지 않는다. (연결 해제가 서버에서 막히는 게시판이 있다)
    if (_isEditing) {
      return Padding(
        padding: const EdgeInsets.only(bottom: AppSizes.paddingMedium),
        child: InputDecorator(
          decoration: const InputDecoration(
            labelText: AppStrings.selectFestival,
            border: OutlineInputBorder(),
          ),
          child: Text(widget.post?.festival?.name ?? '-'),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.paddingMedium),
      child: DropdownButtonFormField<int>(
        initialValue: _selectedFestivalId,
        isExpanded: true,
        decoration: const InputDecoration(
          labelText: AppStrings.selectFestival,
          border: OutlineInputBorder(),
        ),
        items: _festivals
            .map((festival) => DropdownMenuItem(
                  value: festival.id,
                  child: Text(festival.name, overflow: TextOverflow.ellipsis),
                ))
            .toList(),
        onChanged: (id) => setState(() => _selectedFestivalId = id),
      ),
    );
  }
}
